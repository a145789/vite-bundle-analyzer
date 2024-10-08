import type { ZlibOptions } from 'zlib'
import type { HookHandler, Plugin } from 'vite'
import { noop } from 'foxact/noop'
import { AnalyzerModule } from './analyzer-module'

type RenderChunkFunction = HookHandler<Plugin['renderChunk']>

export type GenerateBundleFunction = HookHandler<Plugin['generateBundle']>

const renderChunk: RenderChunkFunction = noop

const generateBundle: GenerateBundleFunction = noop

export type RenderChunk = Parameters<typeof renderChunk>[1]

export type PluginContext = ThisParameterType<typeof renderChunk>

export type RenderedModule = RenderChunk['modules'][string]

export type OutputBundle = Parameters<typeof generateBundle>[1]

export type OutputAsset = Extract<OutputBundle[0], { type: 'asset' }>

export type OutputChunk = Extract<OutputBundle[0], { type: 'chunk' }>

export type ModuleInfo = NonNullable<ReturnType<PluginContext['getModuleInfo']>>

export type AnalyzerMode = 'static' | 'json' | 'server'
// `vite-plugin-analyzer` reports three values of size. (Same as `webpack-bundle-analyzer`)
// But still have to retell it here
// `stat` This is the `input` size of your file, before any transformations like minification.
// `parsed` This is the `output` size of your bundle files. (In vite's, vite will using terser or esbuild to minified size of your code.)
// `gzip` This is the size of running the parsed bundles/modules through gzip compression.
export type DefaultSizes = 'stat' | 'parsed' | 'gzip'

export interface Module {
  label: string
  filename: string
  isEntry: boolean
  statSize: number
  parsedSize: number
  mapSize: number
  gzipSize: number
  source: Array<Module>
  stats: Array<Module>
  imports: Array<string>
  groups: Array<Module>
  isAsset?: boolean
}

export interface BasicAnalyzerPluginOptions {
  summary?: boolean
  analyzerMode?: AnalyzerMode
  reportTitle?: string
  gzipOptions?: ZlibOptions
}

export interface AnalyzerPluginOptionsWithServer extends BasicAnalyzerPluginOptions {
  analyzerMode?: 'server'
  analyzerPort?: number | 'auto'
  openAnalyzer?: boolean
}

export interface AnalyzerPluginOptionsWithStatic extends BasicAnalyzerPluginOptions {
  analyzerMode?: 'static' | 'json'
  fileName?: string
}

export type AnalyzerPluginOptions = AnalyzerPluginOptionsWithServer | AnalyzerPluginOptionsWithStatic

export interface AnalyzerStore {
  previousSourcemapOption: boolean
  hasSetSourcemapOption: boolean
  analyzerModule: AnalyzerModule
}
