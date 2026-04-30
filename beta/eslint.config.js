module.exports = [
    {
        ignores: [
            "**/node_modules/**",
            "**/thirdparty/**",
            "lite/vendor/**",
            "shared/vendor/**",
            "**/*.min.js"
        ]
    },
    {
        linterOptions: {
            reportUnusedDisableDirectives: "off"
        }
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "script"
        }
    },
    {
        files: [
            "cohost-local-qwen-worker.js",
            "local-browser-model-worker.js",
            "docs/js/**/*.js",
            "lite/**/*.js",
            "providers/**/*.js",
            "shared/**/*.js"
        ],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module"
        }
    }
];
