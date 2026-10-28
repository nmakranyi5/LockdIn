// app.json holds the app's settings; this only adds the one thing that depends
// on where the web build is hosted. GitHub Pages serves a project at
// /<repo name>/, so the web build is exported with EXPO_BASE_URL=/LockdIn.
// Leave it unset for the phone apps and for local development.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
