module.exports = {
    apps: [
        {
            name: 'quotes-traffic-simulator',
            script: './dist/index-continuous.js',  // Changed to continuous
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
            cron_restart: '0 3 * * *',
            max_restarts: 5,
            min_uptime: '10s'
        }
    ]
};