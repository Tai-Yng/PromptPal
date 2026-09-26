# Tasks

## 1. 桌宠灵动包

- [x] 1.1 眼睛跟随：usePetMovement 暴露全局光标的窗口内相对坐标（复用穿透轮询），DesktopPet 瞳孔按方向偏移（限幅 ±3px，CSS transform），睡眠/精灵模式跳过——验证：手测瞳孔跟随、睡眠时不跟随
- [x] 1.2 庆祝小跳 celebrate()：hop 定位复用 + 天线球连闪 + 星星粒子（CSS keyframes 600ms），接入复制成功路径——验证：手测复制时小跳与粒子、600ms 后清理
- [x] 1.3 组 1 commit（`feat(pet): eye tracking + celebration`）并推送——验证：CI 绿

## 2. 状态文件协议 + 徽章

- [x] 2.1 Rust `read_agent_state` 命令（读 `~/.promptpal/agent_state.json` 返回字符串或空）+ `read_settings_file`/`write_settings_file` 白名单命令（严格匹配三端配置路径），注册 invoke_handler——验证：cargo check 通过
- [x] 2.2 新 `services/agentState.ts`：协议解析（损坏容忍）+ 90s 超时回落逻辑，纯函数断言进 test-pure.mjs——验证：`npm test` 全绿
- [x] 2.3 DesktopPet 1s 轮询 + agentBadge 徽章（working 蓝脉冲/done 绿）+ done 庆祝小跳与「✓ Agent done」气泡 + settingsStore `agentLinkEnabled` 总开关（默认关、关闭不轮询）——验证：手写状态文件手测徽章/庆祝/超时回落
- [x] 2.4 组 2 commit（`feat(pet): agent state file protocol + badge`）并推送——验证：CI 绿

## 3. 三端安装器

- [x] 3.1 安装器核心 `services/agentInstaller.ts`：三端格式追加/查重/按标记卸载（ZCode/Claude JSON parse-edit、Codex TOML append-only 文本层），hook 命令生成（PowerShell stdin→状态文件）——验证：纯函数断言（样例 JSON/TOML 进出）进 test-pure.mjs 全绿
- [x] 3.2 PetTab agents 区 UI：总开关 + 三行代理开关与安装状态显示，操作经 Rust 白名单命令读写真实配置——验证：手测三端接入（用户真实配置共存验证）、重复开启防重、卸载干净
- [ ] 3.3 三端实测：ZCode 下发一个任务观察 working→done 徽章与庆祝；Claude/Codex 同——验证：真实端到端通过
- [ ] 3.4 组 3 commit（`feat(pet): agent hook installers (zcode/claude/codex)`）并推送——验证：CI 绿

## 4. 收尾

- [x] 4.1 版本 1.6.0：package.json、README 徽章、CHANGELOG——验证：三处一致
- [ ] 4.2 全量终验：对照两份 spec 场景手测，通过后 `openspec archive`
