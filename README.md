# FigZima Flow

A Figma plugin for seamless file management with NAS servers, supporting import and export operations between Figma and your local NAS.

## 功能特性

- 🗂️ **文件浏览器**: 浏览NAS服务器上的文件和文件夹
- 📤 **导出功能**: 将Figma设计导出为PNG、JSON等格式并上传到NAS
- 📥 **导入功能**: 从NAS下载图片、SVG、JSON文件并导入到Figma
- 🔄 **实时同步**: 支持文件列表刷新和实时状态更新
- ⚠️ **错误处理**: 完善的错误提示和网络状态监控

## 支持的文件格式

### 导出格式
- PNG (2x分辨率)
- JSON (页面数据)

### 导入格式
- 图片: PNG, JPG, JPEG, GIF
- 矢量: SVG
- 数据: JSON

## 安装和使用

### 1. 环境准备

确保你已经安装了Node.js和npm：
```bash
# 检查Node.js版本
node --version

# 检查npm版本
npm --version
```

### 2. 安装依赖

在插件目录中运行：
```bash
npm install
```

### 3. 编译代码

```bash
npm run build
```

### 4. 在Figma中安装插件

1. 打开Figma
2. 进入 `Plugins > Development > Import plugin from manifest...`
3. 选择这个插件文件夹
4. 插件将出现在你的插件列表中

### 5. 配置NAS连接

在使用插件之前，你需要在代码中配置NAS服务器信息：

1. 打开 `ui.html` 文件
2. 找到 `NAS_CONFIG` 对象
3. 更新以下配置：
   ```javascript
   const NAS_CONFIG = {
       baseUrl: 'http://你的NAS地址:端口',
       token: '你的访问令牌'
   };
   ```

## 使用说明

### 导出文件到NAS

1. 在Figma中选择要导出的图层或对象
2. 打开Zima NAS插件
3. 浏览到目标文件夹
4. 点击"📤 导出到NAS"按钮
5. 插件会自动导出选中内容为PNG和JSON文件

### 从NAS导入文件

1. 打开Zima NAS插件
2. 浏览到包含文件的文件夹
3. 选择要导入的文件
4. 点击"📥 导入到Figma"按钮
5. 文件将被导入到当前Figma页面

### 文件浏览

- 点击文件夹图标进入子文件夹
- 使用路径导航快速跳转
- 点击"🔄 刷新"按钮更新文件列表
- 连接状态显示在顶部

## API接口说明

### 文件列表接口
```
GET /v2_1/files/file?path={路径}&index=0&size=10000&sfz=true&sort=name&direction=asc
Headers: Authorization: {token}
```

### 文件上传接口
```
POST /v2_1/files/upload
Headers: 
  Authorization: {token}
  Content-Type: application/json
Body: {
  filename: "文件名",
  path: "目标路径", 
  data: "base64编码的文件数据",
  encoding: "base64"
}
```

### 文件下载接口
```
GET /v2_1/files/download?path={文件路径}
Headers: Authorization: {token}
```

## 开发说明

### 项目结构
```
├── code.ts          # 主插件代码
├── ui.html          # 用户界面
├── manifest.json    # 插件配置
├── package.json     # 项目配置
└── tsconfig.json    # TypeScript配置
```

### 开发流程

1. 修改代码后运行 `npm run build` 编译
2. 在Figma中重新加载插件测试
3. 查看浏览器控制台获取调试信息

### 注意事项

- 插件使用自定义的base64编码/解码函数，因为Figma环境中不支持原生的btoa/atob
- 网络请求受Figma插件安全策略限制，需要在manifest.json中配置允许的域名
- 文件上传使用JSON格式传输base64编码的数据，而不是FormData

## 故障排除

### 连接失败
- 检查NAS服务器地址和端口是否正确
- 确认访问令牌是否有效
- 检查网络连接

### 导入/导出失败
- 确认文件格式是否支持
- 检查文件大小是否过大
- 查看控制台错误信息

### 编译错误
- 运行 `npm install` 重新安装依赖
- 检查TypeScript语法错误
- 确认所有必需的类型定义已安装

## 许可证

此项目仅供学习和开发使用。
