/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
export const environment = {
  production: true,
  apiBase: '/api',
  // Relative ws:// URLs aren't valid; the prod build needs an absolute URL
  // (browser-derived window.location.host won't work in environment.ts at
  // compile time). Build-time replacement is the operator's job — set this
  // to the public WSS URL, e.g. 'wss://nexus.example.com/events'.
  wsBase: 'wss://localhost/events',
};
