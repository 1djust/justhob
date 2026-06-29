"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
const path_1 = __importDefault(require("path"));
exports.default = (0, config_1.defineConfig)({
    test: {
        /* Global test settings */
        globals: true,
        environment: "node",
        /* Test file patterns */
        include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
        /* Timeout for each test (ms) */
        testTimeout: 30_000,
        /* Timeout for each hook (ms) */
        hookTimeout: 30_000,
        /* Setup files to run before tests */
        setupFiles: ["./tests/setup.ts"],
        /* Coverage configuration */
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            include: ["src/**/*.ts"],
            exclude: ["src/index.ts", "src/**/*.d.ts"],
        },
    },
    resolve: {
        alias: {
            "@": path_1.default.resolve(__dirname, "./src"),
        },
    },
});
