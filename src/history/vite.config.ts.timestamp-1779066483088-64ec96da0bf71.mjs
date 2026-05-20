import "node:module";
import { defineConfig } from "file:///C:/Users/lyer/AppData/Roaming/TRAE%20SOLO%20CN/ModularData/ai-agent/work-mode-projects/6a09d2c1a2819317bb379a64/PromptPal/node_modules/vite/dist/node/index.js";
import vue from "file:///C:/Users/lyer/AppData/Roaming/TRAE%20SOLO%20CN/ModularData/ai-agent/work-mode-projects/6a09d2c1a2819317bb379a64/PromptPal/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import.meta.url;
var vite_config_default = defineConfig({
	plugins: [vue()],
	clearScreen: false,
	server: {
		port: 5176,
		host: true,
		strictPort: true
	},
	envPrefix: ["VITE_", "TAURI_"],
	build: {
		target: [
			"es2021",
			"chrome100",
			"safari13"
		],
		minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
		sourcemap: !!process.env.TAURI_DEBUG
	}
});
//#endregion
export { vite_config_default as default };

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS5jb25maWcuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiQzovVXNlcnMvbHllci9BcHBEYXRhL1JvYW1pbmcvVFJBRSBTT0xPIENOL01vZHVsYXJEYXRhL2FpLWFnZW50L3dvcmstbW9kZS1wcm9qZWN0cy82YTA5ZDJjMWEyODE5MzE3YmIzNzlhNjQvUHJvbXB0UGFsL3ZpdGUuY29uZmlnLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgdnVlIGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZSdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFt2dWUoKV0sXG4gIC8vIOmYsuatoiB2aXRlIOaooeeziuaQnOe0ouWNoOeUqCBDUFVcbiAgY2xlYXJTY3JlZW46IGZhbHNlLFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA1MTc2LFxuICAgIGhvc3Q6IHRydWUsXG4gICAgc3RyaWN0UG9ydDogdHJ1ZVxuICB9LFxuICAvLyBUYXVyaSDnjq/looPkuIvmnoTlu7rkvJjljJZcbiAgZW52UHJlZml4OiBbJ1ZJVEVfJywgJ1RBVVJJXyddLFxuICBidWlsZDoge1xuICAgIC8vIFRhdXJpIOS9v+eUqCBDaHJvbWl1be+8jOebruaghyBlczIwMjFcbiAgICB0YXJnZXQ6IFsnZXMyMDIxJywgJ2Nocm9tZTEwMCcsICdzYWZhcmkxMyddLFxuICAgIG1pbmlmeTogIXByb2Nlc3MuZW52LlRBVVJJX0RFQlVHID8gJ2VzYnVpbGQnIDogZmFsc2UsXG4gICAgc291cmNlbWFwOiAhIXByb2Nlc3MuZW52LlRBVVJJX0RFQlVHXG4gIH1cbn0pXG4iXSwibWFwcGluZ3MiOiI7Ozs7QUFJQSxJQUFBLHNCQUFlLGFBQWE7Q0FDMUIsU0FBUyxDQUFDLElBQUksQ0FBQztDQUVmLGFBQWE7Q0FDYixRQUFRO0VBQ04sTUFBTTtFQUNOLE1BQU07RUFDTixZQUFZO0NBQ2Q7Q0FFQSxXQUFXLENBQUMsU0FBUyxRQUFRO0NBQzdCLE9BQU87RUFFTCxRQUFRO0dBQUM7R0FBVTtHQUFhO0VBQVU7RUFDMUMsUUFBUSxDQUFDLFFBQVEsSUFBSSxjQUFjLFlBQVk7RUFDL0MsV0FBVyxDQUFDLENBQUMsUUFBUSxJQUFJO0NBQzNCO0FBQ0YsQ0FBQyJ9