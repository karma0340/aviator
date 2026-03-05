export const config = {
  development: false,
  debug: true,
  appKey: "crash-0.1.0",
  api: `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`,
  wss: (process.env.REACT_APP_API_URL || 'http://localhost:5000') as string,
};
