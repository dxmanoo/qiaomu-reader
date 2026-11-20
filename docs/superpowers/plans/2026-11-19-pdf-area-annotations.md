# 乔木阅读器 Fork 与 PDF 区域批注开发计划

## 建仓与交付

在 `dxmanoo/qiaomu-reader` 建立公开 Fork，父仓库为 `joeseesun/qiaomu-reader`。`origin` 指向 Fork，`upstream` 指向乔木原仓库。从 `44c04ed3c501ffc5616e184530d0574174e9b4b9` 创建 `feat/pdf-area-annotations`，将本计划提交并推送。通过 GitHub API 核对父仓库，用远程分支提交核对计划文档。

## 首版目标

在桌面 Obsidian 打开扫描 PDF 或带图表的文字 PDF，框选区域并点击颜色保存。书籍阅读笔记显示 PNG、页码、可选评论和「返回原文」。回链打开对应 PDF，将原框滚入视野并短暂强调。

- 工具栏「区域批注」激活后显示十字光标，左键可四向拖选，选区限于起始页。宽、高均须超过 10 CSS 像素。中键可平移。短拖清除预览并保留模式。
- 有效拖动后退出模式并保留选区。颜色浮层靠近选区、尽量避开原文并留在阅读窗内。可用键盘确认颜色，按 Esc、点浮层外或切页可取消。保存中显示状态，失败时保留选区供重试。
- 保存后以细彩色边框显示。点击区域可改色、编辑评论或删除。批注面板显示页码和缩略图。自动汇总成功后提示「已添加到阅读笔记」。
- 定位保留缩放。正常动效短暂闪烁，减少动态效果时静态强调。记录已删除时，回链仍打开对应页。

[Logseq 框选](https://github.com/logseq/logseq/blob/2a0dce924d548005d8e9215b3d4467f6a07964eb/src/main/frontend/extensions/pdf/core.cljs#L417-L575) · [批注列表](https://github.com/logseq/logseq/blob/2a0dce924d548005d8e9215b3d4467f6a07964eb/src/main/frontend/extensions/pdf/toolbar.cljs#L376-L460) · [精确回跳](https://github.com/logseq/logseq/blob/2a0dce924d548005d8e9215b3d4467f6a07964eb/src/main/frontend/extensions/pdf/utils.js#L103-L141)

## 开发里程碑

每阶段先写可复现目标行为的测试，确认失败，然后实施最小改动。通过验证后独立提交。

- [x] **M0 · 上游基线**。使用 Node 22，安装依赖，运行上游测试与构建。在独立 Vault 验证扫描 PDF 阅读、文字 PDF 划线与同步、EPUB 打开和回跳。
- [x] **M1 · 单页框选**。在 `src/main.js` 的 PDF 公共入口接入按钮、指针捕获和预览。由 `src/pdf-region.js` 计算图像内容区坐标，排除边框，通过 PDF.js PageViewport 映射为 PDF 原始坐标。验证四向拖动、跨页限制、小框、窄窗、分页与滚动、缩放和旋转页。
- [x] **M2 · 截图与持久化**。PDF 懒渲染器从原 PDF 局部重绘 PNG，最长边 2048 像素，复用渲染超时和关闭取消。附件写入 Vault 的 `Qiaomu PDF Annotations/`，文件名为 UUID。现有 `reading-highlights.json` 增加 `kind: "pdf-region"`、`page`、`bounds`、`imagePath`，复用 ID、颜色和评论。先写附件，再串行提交记录，重试复用 ID。验证 PNG 内容、重试去重及旧版兼容。
- [x] **M3 · 笔记和管理**。批注面板显示缩略图。阅读笔记托管章节嵌入 PNG、页码、可选评论和回链，遵循已有自动建笔记、同步与回链设置。笔记同步失败时提示并允许重试。删除框及托管条目时保留附件供已有引用。验证手写笔记、手工摘录和文字划线。
- [x] **M4 · 精确回跳**。`src/highlight-navigation.js` 生成带页码和批注 ID 的既有协议回链。分页与滚动分别按实际布局定位，等待页面覆盖层就绪再强调目标。验证同页多个框、高倍缩放、重启、懒加载和删除后的页码回退。

## 完成标准

- 在桌面 Obsidian 的独立 Vault 用扫描 PDF、文字 PDF 和旋转页 PDF 验证「框选 → 截图 → 笔记嵌图 → 重启 → 精确回跳」。同时检查双栏、窄窗和附件写入失败。
- 通过 `npm test`、`npm run check:i18n`、`npx eslint src/ --max-warnings=0`、`npm run build`、`npm run verify:release`、`npm run build:community` 和上游安装资产体积检查。
- 首版沿用乔木插件 ID、PDF.js 6 与 Vault 工作流，独立实现 Logseq 式交互。移动触控、OCR、Logseq 批注导入和写回 PDF 留待后续。

## 验收记录

- **上游基线**。Node 22 的 605 项测试通过。上游构建在独立 Vault 中验证了扫描 PDF 阅读、文字划线与笔记同步、EPUB 打开和 CFI 回链。
- **区域批注**。桌面 Obsidian 实测了同页多个框、扫描页截图像素、文字页、90° 旋转页、双栏、连续滚动、150% 缩放与 690 像素窄窗。阅读视图确认 PNG 可显示。重启后用笔记中的回链定位到原框。区域删除后，笔记条目移除、PNG 保留，旧链接回退到原页。
- **故障恢复**。分别模拟附件写入和阅读笔记写入失败。附件重试保留选区并创建一条记录。笔记同步重试保留已保存批注和手写段落。现有文字划线与 EPUB 回链通过回归。
- **发布检查**。611 项 Node 测试、11 项 Python 测试、国际化、ESLint、两种构建与安装资产校验均通过。标准版 `main.js` 为 4,764,727 字节，社区版为 4,764,728 字节，均低于 4,800,000 字节。静态语言与 CMap 数据的构建编码收紧，原字典内容保持一致。

## 桌面交互补充

- 在 macOS 按住 `⌘` 并用左键拖动，Windows 和 Linux 使用 `Shift`。PDF 缩放菜单显示当前平台的提示。松手后沿用现有颜色浮层。
- 拖动已保存框的任一边调整范围，松手后更新书籍笔记中的 PNG，原批注和回链保持有效。旧 PNG 保留给已有引用。拖动中按 `Esc` 放弃，保存失败则可以重试同一选区。
- 在 macOS 桌面 Obsidian 验证了扫描页、旋转页、原回链跳到新框、取消拖动以及批注存储写入失败后的重试。Windows 和 Linux 的修饰键映射由自动化测试覆盖。614 项 Node 测试、国际化、ESLint、两种构建和安装文件校验通过。

## ObsReader 独立安装

插件名称为 ObsReader，ID 为 `obsreader`。与原乔木阅读器共存时，从文件右键菜单选择带 ObsReader 的打开项。ObsReader 使用自己的回链协议、阅读进度、批注文件、截图目录和阅读笔记标记。双插件隔离 Vault 验证了对同一 PDF 新增批注后，原乔木阅读笔记和批注库保持一致。
