import { SourceMapConsumer } from 'source-map'
import type { MappingItem } from 'source-map'

export async function convertSourcemapToContents(rawSourceMap: string) {
  const consumer = await new SourceMapConsumer(rawSourceMap)
  const sources = await consumer.sources
  const result = sources.reduce((sourceObj, source) => {
    const s = consumer.sourceContentFor(source, true)
    if (s) sourceObj[source] = s
    return sourceObj
  }, {} as Record<string, string>)
  consumer.destroy()
  return result
}

type Loc = MappingItem & { lastGeneratedColumn: number | null }

function splitBytesByNewLine(bytes: Uint8Array) {
  const result = []
  let start = 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0A) {
      const line = bytes.subarray(start, i)
      result.push(line)
      start = i + 1
    }
  }

  if (start < bytes.length) {
    result.push(bytes.subarray(start))
  }
  return result
}

// serialize external mappings means 
// split code by char '\n' and resotre the finally raw code
// we convert javaScript String to unit8Array but like chinese characters and the like may occupy more bytes if they are encoded in UTF8.
// So we should respect the generated column (Because javaScript String are encoded according to UTF16)
function getStringFromSerializeMappings(bytes: Uint8Array[], mappings: Array<Loc>, decoder: TextDecoder) {
  const mappingsWithLine: Record<number, Array<Loc>> = {}
  let parsedString = ''
  for (const mapping of mappings) {
    const { generatedLine } = mapping
    if (!(generatedLine in mappingsWithLine)) {
      mappingsWithLine[generatedLine] = []
    }
    mappingsWithLine[generatedLine].push(mapping)
  }
  for (const line in mappingsWithLine) {
    const l = parseInt(line) - 1
    if (bytes[l]) {
      const runes = decoder.decode(bytes[l])
      const mappings = mappingsWithLine[line]
      const [first, ...rest] = mappings
      const end = rest[rest.length - 1]
      if (first && end) {
        if (typeof end.lastGeneratedColumn !== 'number') {
          parsedString += runes.substring(first.generatedColumn)
        } else {
          parsedString += runes.substring(first.generatedColumn, end.lastGeneratedColumn ?? end.generatedColumn)
        }
      }
    }
  }
  return parsedString
}

// https://esbuild.github.io/faq/#minified-newlines
// https://github.com/terser/terser/issues/960
// an unstable mapping computed function
// There seems to be some problems with the sourcemap generated by terser.
export async function getSourceMappings(code: Uint8Array, rawSourceMap: string, formatter: (id: string) => Promise<string>) {
  const hints: Record<string, string> = {}
  const bytes = splitBytesByNewLine(code)
  const promises: Array<[() => Promise<string>, MappingItem]> = []
  const decoder = new TextDecoder()
  const consumer = await new SourceMapConsumer(rawSourceMap)
  consumer.eachMapping(mapping => {
    if (mapping.source) promises.push([() => Promise.resolve(formatter(mapping.source)), mapping])
  }, null, SourceMapConsumer.ORIGINAL_ORDER)

  const mappings = await Promise.all(promises.map(async ([fn, mapping]) => {
    const id = await fn()
    return { mapping, id }
  }))

  const sortedMappings = mappings.reduce((acc, cur) => {
    if (!acc[cur.id]) {
      acc[cur.id] = {
        mappings: []
      }
    }
    acc[cur.id].mappings.push(cur.mapping as any)
    return acc
  }, {} as Record<string, { mappings: Array<Loc> }>)

  for (const key in sortedMappings) {
    sortedMappings[key].mappings.sort((a, b) => a.generatedColumn - b.generatedColumn)
    const { mappings } = sortedMappings[key]
    if (mappings.length > 0) {
      const s = getStringFromSerializeMappings(bytes, mappings, decoder)
      hints[key] = s
    }
  }
  consumer.destroy()
  return hints
}
