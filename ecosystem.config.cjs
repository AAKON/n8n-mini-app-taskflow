module.exports = {
  apps: [
    {
      name: 'taskflow',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};