# auv · 北京话学习助手

一个 Windows 桌面应用：用 AI 学地道北京话。

## 功能

- 输入或按住说话，得到北京话写法、拼音、解释
- 千问 TTS「北京-晓东」京腔朗读
- 5 节循序渐进课程，进度本地保存
- iOS 27 风格液态玻璃界面、动态引导

## 使用

1. 安装 `auv-Setup-1.0.0.exe`，或直接运行免安装版
2. 打开右上角 ⚙，填入：
   - DeepSeek API Key（对话）
   - 阿里云百炼 API Key（京腔朗读 + 语音识别）
3. 输入「西红柿怎么说」开始

## 开发

```bash
npm install
npm start
npm run dist
```

## 说明

- Key 只加密保存在本机，不会上传
- 未签名 exe 首次运行可能触发 Windows SmartScreen：更多信息 → 仍要运行
- 北京话音色来自阿里云百炼 Qwen3-TTS（Dylan / 北京-晓东）