/**
 * handler.js
 * Cloud Run / Vercel / Firebase Functions serverless request adapter.
 */

import { handleRequest } from '../server.js';

export default async function handler(req, res) {
  return handleRequest(req, res);
}
