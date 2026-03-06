const isProd = process.env.NODE_ENV === 'production';
const defaultHost = isProd ? window.location.origin : 'http://localhost:5000';
const host = process.env.REACT_APP_API_URL || defaultHost;

export const config = {
  development: !isProd,
  debug: true,
  appKey: "crash-0.1.0",
  api: `${host}/api`,
  wss: host as string,
};
