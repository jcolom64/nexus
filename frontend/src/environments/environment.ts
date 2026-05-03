/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

export const environment = {
  production: false,
  apiBase: 'http://localhost:3001/api',
  // WebSocket gateway URL — separate from apiBase because NestJS's
  // setGlobalPrefix('api') doesn't apply to WS gateways; the path comes
  // from @WebSocketGateway({ path: '/events' }) verbatim.
  wsBase: 'ws://localhost:3001/events',
};
