module.exports = {
    apps: [{
        name: 'quotes-traffic-simulator',
        script: './dist/index-loop.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        env: {
            NODE_ENV: 'production'
        },
        // Restart once daily at 3 AM (to clear any memory leaks)
        cron_restart: '0 3 * * *',
        // Max restarts in 1 minute before stopping
        max_restarts: 5,
        min_uptime: '10s'
    }]
};