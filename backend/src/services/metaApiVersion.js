/**
 * Versão única da Graph API usada por todo o backend.
 *
 * Antes existiam 4 hardcodes de `v20.0` espalhados (metaHttp, metaToken,
 * metaMedia, routes/platforms). Agora todos importam daqui.
 *
 * Bump: editar o fallback abaixo OU setar META_API_VERSION no Vercel
 * (env var ganha do default sem precisar de deploy de código).
 *
 * Doc: https://developers.facebook.com/docs/graph-api/changelog
 */
const API_VERSION = process.env.META_API_VERSION || 'v22.0';
const GRAPH_HOST = 'graph.facebook.com';
const GRAPH_BASE = `https://${GRAPH_HOST}/${API_VERSION}`;

module.exports = { API_VERSION, GRAPH_HOST, GRAPH_BASE };
