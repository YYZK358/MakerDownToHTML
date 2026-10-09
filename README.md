# 📄 MakerDownToHTML

轻量化的 Markdown → HTML 转换工具。将 `.md` 文件拖入浏览器即可生成带**侧边栏目录**的独立 HTML 文件，输出保存在原 `.md` 文件同目录下。

## 特性

- **拖拽转换** — 支持拖入或选择多个 `.md` / `.markdown` 文件
- **侧边栏目录** — 根据 Markdown 标题自动生成层级目录，滚动时自动高亮当前章节
- **独立 HTML** — 生成的 HTML 无外部依赖，可直接双击打开
- **移动端适配** — 小屏幕下侧边栏可折叠
- **纯前端 + 轻量后端** — 浏览器拖拽 UI + Express 转换服务

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
npm start
# 或开发模式
npm run dev
```

打开浏览器访问 http://localhost:3000，拖入 Markdown 文件即可。

## 使用说明

1. 访问 http://localhost:3000
2. 将 `.md` 文件拖入页面（或点击选择文件），支持批量
3. 点击「开始转换」，浏览器会提示保存 HTML
4. 将保存的 HTML 放在原 `.md` 文件同目录下（同名 `.html`）即可

> 生成的 HTML 中侧边栏的锚点链接指向对应标题，支持平滑导航。

## 项目结构

```
├── converter.js        # Markdown → HTML 转换核心（含侧边栏目录生成）
├── server.js           # Express 服务（/convert API + 静态文件）
├── public/
│   └── index.html      # 拖拽 UI 前端
├── uploads/            # 临时上传目录（自动清理）
├── test/
│   └── sample.md       # 测试用示例文档
└── package.json
```

## 依赖

- [marked](https://github.com/markedjs/marked) — Markdown 解析
- [express](https://expressjs.com/) — Web 服务
- [multer](https://github.com/expressjs/multer) — 文件上传
