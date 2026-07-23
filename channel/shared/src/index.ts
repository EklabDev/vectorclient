export type {
  ChannelTheme,
  ChannelThemeInput,
  InvokeOptions,
  InvokePayload,
  InvokeResult,
  VectorClientConfig,
  VectorClientErrorBody,
} from './types.js';

export {
  buildGatewayUrl,
  ConfigError,
  createConfig,
  DEFAULT_THEME,
  mergeTheme,
  themeToCssVariables,
  themeToInlineStyle,
} from './config.js';

export { messageFromErrorBody, VectorClientError } from './errors.js';

export { createClient, VectorClient } from './client.js';
