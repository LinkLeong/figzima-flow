// Zima NAS Plugin - 用于与本地NAS进行文件导入导出的Figma插件

// 接口定义
interface NASConfig {
  baseUrl: string;
  token: string;
}

interface NASFile {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extensions?: any;
}

interface PluginMessage {
  type: string;
  path?: string;
  file?: NASFile;
  nasConfig?: NASConfig;
  count?: number;
}

interface LoginInfo {
  baseUrl: string;
  token: string;
  expiresAt: number; // 过期时间戳
  username: string;
}

// 全局登录状态
let savedLoginInfo: LoginInfo | null = null;

// 显示UI界面，设置合适的尺寸
figma.showUI(__html__, {
  width: 400,
  height: 600,
  title: 'FigZima Flow'
});

// 检查是否有有效的登录信息
async function checkSavedLogin() {
  try {
    // 从clientStorage读取保存的登录信息
    const savedData = await figma.clientStorage.getAsync('loginInfo');
    console.log('从存储中读取的登录信息:', savedData);

    if (savedData) {
      const loginInfo = savedData as LoginInfo;
      const now = Date.now();

      if (loginInfo.expiresAt > now) {
        console.log('发现有效的登录信息，自动登录');
        console.log('过期时间:', new Date(loginInfo.expiresAt).toLocaleString());

        // 更新内存中的登录信息
        savedLoginInfo = loginInfo;

        figma.ui.postMessage({
          pluginMessage: {
            type: 'auto-login-success',
            data: {
              baseUrl: loginInfo.baseUrl,
              token: loginInfo.token,
              username: loginInfo.username
            }
          }
        });
        return true;
      } else {
        console.log('登录信息已过期，清除保存的信息');
        console.log('当前时间:', new Date(now).toLocaleString());
        console.log('过期时间:', new Date(loginInfo.expiresAt).toLocaleString());

        // 清除过期的登录信息
        await figma.clientStorage.deleteAsync('loginInfo');
        savedLoginInfo = null;
      }
    } else {
      console.log('没有找到保存的登录信息');
    }
  } catch (error) {
    console.error('检查登录信息时出错:', error);
  }

  return false;
}

// 插件启动时检查登录状态
setTimeout(async () => {
  console.log('插件启动，开始检查保存的登录状态...');
  await checkSavedLogin();
}, 1000); // 延迟1秒确保UI已加载

// 扩展消息接口
interface LoginMessage extends PluginMessage {
  serverUrl?: string;
  username?: string;
  password?: string;
}

// 处理来自UI的消息
figma.ui.onmessage = async (msg: LoginMessage) => {
  try {
    switch (msg.type) {
      case 'login':
        await handleLogin(msg.serverUrl!, msg.username!, msg.password!);
        break;

      case 'export-to-nas':
        console.log('收到导出到NAS的消息:', msg);
        await handleExportToNAS(msg.path!, msg.nasConfig!);
        break;

      case 'import-from-nas':
        await handleImportFromNAS(msg.file!, msg.nasConfig!);
        break;

      case 'logout':
        await handleLogout();
        break;

      case 'cancel':
        figma.closePlugin();
        break;

      default:
        console.warn('未知的消息类型:', msg.type);
    }
  } catch (error) {
    console.error('处理消息时出错:', error);
    figma.ui.postMessage({
      pluginMessage: {
        type: 'export-error',
        error: error instanceof Error ? error.message : '未知错误'
      }
    });
  }
};

// 处理登录请求
async function handleLogin(serverUrl: string, username: string, password: string) {
  // 尝试多种协议组合，但保持用户输入的地址不变
  const urlsToTry = [];

  // 如果用户输入的是HTTP，也尝试HTTPS
  if (serverUrl.startsWith('http://')) {
    urlsToTry.push(serverUrl);
    urlsToTry.push(serverUrl.replace('http://', 'https://'));
  } else if (serverUrl.startsWith('https://')) {
    urlsToTry.push(serverUrl);
    urlsToTry.push(serverUrl.replace('https://', 'http://'));
  } else {
    // 如果没有协议，尝试两种
    urlsToTry.push(`http://${serverUrl}`);
    urlsToTry.push(`https://${serverUrl}`);
  }

  let lastError: Error | null = null;

  for (const baseUrl of urlsToTry) {
    try {
      console.log('尝试登录到:', `${baseUrl}/v1/users/login`);

      const response = await fetch(`${baseUrl}/v1/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: username,
          password: password
        })
      });

      console.log('登录响应状态:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('登录响应错误:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('登录响应数据:', result);

      if (result.success === 200 && result.data && result.data.token) {
        // 登录成功，保存登录信息
        console.log(`登录成功，使用URL: ${baseUrl}`);

        // 保存登录信息到内存和持久存储
        savedLoginInfo = {
          baseUrl: baseUrl,
          token: result.data.token.access_token,
          expiresAt: result.data.token.expires_at * 1000, // 转换为毫秒
          username: username
        };

        console.log('保存登录信息:', {
          baseUrl: savedLoginInfo.baseUrl,
          expiresAt: new Date(savedLoginInfo.expiresAt).toLocaleString(),
          username: savedLoginInfo.username
        });

        // 保存到持久存储
        try {
          await figma.clientStorage.setAsync('loginInfo', savedLoginInfo);
          console.log('登录信息已保存到持久存储');
        } catch (storageError) {
          console.error('保存登录信息到存储失败:', storageError);
        }

        const successMessage = {
          pluginMessage: {
            type: 'login-success',
            data: {
              baseUrl: baseUrl,
              token: result.data.token.access_token,
              username: username
            }
          }
        };
        console.log('发送登录成功消息到UI:', successMessage);
        figma.ui.postMessage(successMessage);
        return; // 成功后直接返回
      } else {
        throw new Error(result.message || '登录失败');
      }

    } catch (error) {
      console.error(`使用 ${baseUrl} 登录失败:`, error);
      lastError = error instanceof Error ? error : new Error('未知错误');
      // 继续尝试下一个URL
    }
  }

  // 所有URL都失败了
  console.error('所有登录尝试都失败了');

  let errorMessage = '登录失败';
  if (lastError) {
    if (lastError.message.includes('fetch') || lastError.message.includes('ERR_')) {
      errorMessage = '无法连接到NAS服务器，请检查：\n1. 服务器地址是否正确\n2. NAS服务器是否运行\n3. 网络连接是否正常';
    } else {
      errorMessage = lastError.message;
    }
  }

  figma.ui.postMessage({
    pluginMessage: {
      type: 'login-error',
      error: errorMessage
    }
  });
}

// 处理登出请求
async function handleLogout() {
  console.log('用户登出，清除保存的登录信息');

  // 清除内存中的登录信息
  savedLoginInfo = null;

  // 清除持久存储中的登录信息
  try {
    await figma.clientStorage.deleteAsync('loginInfo');
    console.log('已从持久存储中清除登录信息');
  } catch (storageError) {
    console.error('清除存储中的登录信息失败:', storageError);
  }

  figma.ui.postMessage({
    pluginMessage: {
      type: 'logout-success'
    }
  });
}

// 导出到NAS的处理函数
async function handleExportToNAS(targetPath: string, nasConfig: NASConfig) {
  try {
    console.log('开始处理导出到NAS:', { targetPath, nasConfig });

    // 检查是否有选中的内容
    const selection = figma.currentPage.selection;
    console.log('当前选中的内容:', selection.length, '个对象');

    if (selection.length === 0) {
      console.log('没有选中内容，发送no-selection消息');
      figma.ui.postMessage({
        pluginMessage: { type: 'no-selection' }
      });
      return;
    }

    // 导出选中的内容为PNG
    const exportSettings: ExportSettings = {
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 } // 2x分辨率
    };

    // 为每个选中的节点导出图片
    for (let i = 0; i < selection.length; i++) {
      const node = selection[i];
      console.log(`处理第${i + 1}个节点:`, node.name, node.type);

      if ('exportAsync' in node) {
        console.log('开始导出节点为PNG...');
        const bytes = await node.exportAsync(exportSettings);
        const fileName = `${node.name || 'untitled'}_${Date.now()}.png`;
        console.log(`导出完成，文件名: ${fileName}, 大小: ${bytes.length} bytes`);

        // 上传到NAS
        console.log('开始上传到NAS...');
        await uploadFileToNAS(bytes, fileName, targetPath, nasConfig);
        console.log('上传完成');
      } else {
        console.log('节点不支持导出:', (node as any).type);
      }
    }

    // 如果只有一个文件，也导出当前页面的JSON数据
    if (selection.length === 1) {
      const pageData = {
        name: figma.currentPage.name,
        selection: selection.map(node => ({
          id: node.id,
          name: node.name,
          type: node.type,
          // 添加更多需要的属性
        })),
        timestamp: new Date().toISOString()
      };

      const jsonData = JSON.stringify(pageData, null, 2);
      const jsonBytes = stringToUint8Array(jsonData);
      const jsonFileName = `${figma.currentPage.name}_${Date.now()}.json`;

      await uploadFileToNAS(jsonBytes, jsonFileName, targetPath, nasConfig);
    }

    figma.ui.postMessage({
      pluginMessage: { type: 'export-success' }
    });

  } catch (error) {
    console.error('导出失败:', error);
    figma.ui.postMessage({
      pluginMessage: {
        type: 'export-error',
        error: error instanceof Error ? error.message : '导出失败'
      }
    });
  }
}

// 上传文件到NAS
async function uploadFileToNAS(
  fileData: Uint8Array,
  fileName: string,
  targetPath: string,
  nasConfig: NASConfig
) {
  try {
    console.log(`准备上传文件: ${fileName} 到路径: ${targetPath}`);
    console.log(`文件大小: ${fileData.length} bytes`);
    console.log('NAS配置:', nasConfig);

    // 使用ZimaOS v2_1上传接口
    const uploadUrl = `${nasConfig.baseUrl}/v2_1/files/file/uploadV2`;

    // 由于Figma插件环境限制，我们需要构建multipart/form-data格式的请求体
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 18);
    const formattedFileName = `${fileName}:${fileData.length}`;

    // 构建multipart/form-data请求体
    const formDataParts = [];

    // 添加path字段
    formDataParts.push(`--${boundary}\r\n`);
    formDataParts.push(`Content-Disposition: form-data; name="path"\r\n\r\n`);
    formDataParts.push(`${targetPath}\r\n`);

    // 添加file字段
    formDataParts.push(`--${boundary}\r\n`);
    formDataParts.push(`Content-Disposition: form-data; name="file"; filename="${formattedFileName}"\r\n`);
    formDataParts.push(`Content-Type: ${getContentType(fileName)}\r\n\r\n`);

    // 将字符串部分转换为Uint8Array
    const headerBytes = stringToUint8Array(formDataParts.join(''));
    const footerBytes = stringToUint8Array(`\r\n--${boundary}--\r\n`);

    // 合并所有数据
    const totalLength = headerBytes.length + fileData.length + footerBytes.length;
    const requestBody = new Uint8Array(totalLength);
    requestBody.set(headerBytes, 0);
    requestBody.set(fileData, headerBytes.length);
    requestBody.set(footerBytes, headerBytes.length + fileData.length);

    console.log('上传URL:', uploadUrl);
    console.log('目标路径:', targetPath);
    console.log('文件名:', formattedFileName);
    console.log('请求体大小:', requestBody.length);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': nasConfig.token,
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: requestBody
    });

    console.log('上传响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('上传响应错误:', errorText);
      throw new Error(`上传失败: ${response.status} ${response.statusText}`);
    }

    // 先获取响应文本，然后尝试解析JSON
    const responseText = await response.text();
    console.log('响应文本:', responseText);

    let result;
    try {
      if (responseText.trim()) {
        result = JSON.parse(responseText);
        console.log('上传成功，解析的结果:', result);
      } else {
        console.log('上传成功，服务器返回空响应');
        result = { success: true, message: '上传成功' };
      }
    } catch (parseError) {
      console.log('JSON解析失败，但HTTP状态为成功，认为上传成功');
      console.log('原始响应:', responseText);
      console.log('解析错误:', parseError);
      result = { success: true, message: '上传成功' };
    }

  } catch (error) {
    console.error('上传文件失败:', error);

    // 根据错误类型提供更具体的错误信息
    if (error instanceof TypeError && error.message.includes('fetch')) {
      figma.ui.postMessage({
        pluginMessage: { type: 'network-error' }
      });
      throw new Error('网络连接失败，请检查NAS服务器连接');
    }

    if (error instanceof Error && error.message.includes('401')) {
      figma.ui.postMessage({
        pluginMessage: { type: 'auth-error' }
      });
      throw new Error('认证失败，请检查访问令牌');
    }

    throw new Error(`上传文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 根据文件名获取Content-Type
function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const contentTypes: { [key: string]: string } = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'json': 'application/json',
    'txt': 'text/plain'
  };

  return contentTypes[ext || ''] || 'application/octet-stream';
}

// 从NAS导入文件的处理函数
async function handleImportFromNAS(file: NASFile, nasConfig: NASConfig) {
  try {
    if (file.is_dir) {
      throw new Error('无法导入文件夹，请选择文件');
    }

    // 根据文件类型进行不同的处理
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    switch (fileExtension) {
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        await importImageFromNAS(file, nasConfig);
        break;

      case 'svg':
        await importSVGFromNAS(file, nasConfig);
        break;

      case 'json':
        await importJSONFromNAS(file, nasConfig);
        break;

      default:
        throw new Error(`不支持的文件格式: ${fileExtension}`);
    }

    figma.ui.postMessage({
      pluginMessage: { type: 'import-success' }
    });

  } catch (error) {
    console.error('导入失败:', error);
    figma.ui.postMessage({
      pluginMessage: {
        type: 'import-error',
        error: error instanceof Error ? error.message : '导入失败'
      }
    });
  }
}

// 从NAS导入图片
async function importImageFromNAS(file: NASFile, nasConfig: NASConfig) {
  // 下载文件数据
  const imageData = await downloadFileFromNAS(file, nasConfig);

  // 创建图片节点
  const imageNode = figma.createRectangle();
  imageNode.name = file.name;

  // 设置图片填充
  const image = figma.createImage(imageData);
  imageNode.fills = [{
    type: 'IMAGE',
    imageHash: image.hash,
    scaleMode: 'FILL'
  }];

  // 添加到当前页面
  figma.currentPage.appendChild(imageNode);
  figma.currentPage.selection = [imageNode];
  figma.viewport.scrollAndZoomIntoView([imageNode]);
}

// 从NAS导入SVG
async function importSVGFromNAS(file: NASFile, nasConfig: NASConfig) {
  // 下载SVG文件数据
  const svgData = await downloadFileFromNAS(file, nasConfig);
  const svgString = uint8ArrayToString(svgData);

  // 创建SVG节点
  const svgNode = figma.createNodeFromSvg(svgString);
  svgNode.name = file.name;

  // 添加到当前页面
  figma.currentPage.appendChild(svgNode);
  figma.currentPage.selection = [svgNode];
  figma.viewport.scrollAndZoomIntoView([svgNode]);
}

// 从NAS导入JSON数据
async function importJSONFromNAS(file: NASFile, nasConfig: NASConfig) {
  // 下载JSON文件数据
  const jsonData = await downloadFileFromNAS(file, nasConfig);
  const jsonString = uint8ArrayToString(jsonData);

  try {
    const data = JSON.parse(jsonString);

    // 这里可以根据JSON数据的结构来重建Figma元素
    // 例如，如果JSON包含了之前导出的页面数据
    console.log('导入的JSON数据:', data);

    // 创建一个文本节点来显示JSON内容（作为示例）
    const textNode = figma.createText();
    textNode.name = file.name;
    textNode.characters = `导入的JSON文件: ${file.name}\n数据: ${JSON.stringify(data, null, 2)}`;

    figma.currentPage.appendChild(textNode);
    figma.currentPage.selection = [textNode];
    figma.viewport.scrollAndZoomIntoView([textNode]);

  } catch (error) {
    throw new Error('无效的JSON文件格式');
  }
}

// 从NAS下载文件
async function downloadFileFromNAS(file: NASFile, nasConfig: NASConfig): Promise<Uint8Array> {
  try {
    console.log(`准备下载文件: ${file.name} 从路径: ${file.path}`);

    // 使用ZimaOS v3下载接口
    const downloadUrl = `${nasConfig.baseUrl}/v3/file?token=${encodeURIComponent(nasConfig.token)}&files=${encodeURIComponent(file.path)}&action=download`;

    console.log('下载URL:', downloadUrl);

    const response = await fetch(downloadUrl, {
      method: 'GET',
      // ZimaOS v3接口不需要Authorization header，token在URL中
    });

    console.log('下载响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('下载响应错误:', errorText);
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`下载完成，文件大小: ${arrayBuffer.byteLength} bytes`);
    return new Uint8Array(arrayBuffer);

  } catch (error) {
    console.error('下载文件失败:', error);

    // 根据错误类型提供更具体的错误信息
    if (error instanceof TypeError && error.message.includes('fetch')) {
      figma.ui.postMessage({
        pluginMessage: { type: 'network-error' }
      });
      throw new Error('网络连接失败，请检查NAS服务器连接');
    }

    if (error instanceof Error && error.message.includes('401')) {
      figma.ui.postMessage({
        pluginMessage: { type: 'auth-error' }
      });
      throw new Error('认证失败，请检查访问令牌');
    }

    if (error instanceof Error && error.message.includes('400')) {
      throw new Error('文件请求错误，请检查文件路径是否正确');
    }

    throw new Error(`下载文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 辅助函数：字符串转Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

// 辅助函数：Uint8Array转字符串
function uint8ArrayToString(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

// 辅助函数：Uint8Array转Base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;

  while (i < bytes.length) {
    const a = bytes[i++];
    const b = i < bytes.length ? bytes[i++] : 0;
    const c = i < bytes.length ? bytes[i++] : 0;

    const bitmap = (a << 16) | (b << 8) | c;

    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < bytes.length ? chars.charAt(bitmap & 63) : '=';
  }

  return result;
}

// 辅助函数：Base64转Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = [];
  let i = 0;

  while (i < base64.length) {
    const encoded1 = chars.indexOf(base64.charAt(i++));
    const encoded2 = chars.indexOf(base64.charAt(i++));
    const encoded3 = chars.indexOf(base64.charAt(i++));
    const encoded4 = chars.indexOf(base64.charAt(i++));

    const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;

    result.push((bitmap >> 16) & 255);
    if (encoded3 !== 64) result.push((bitmap >> 8) & 255);
    if (encoded4 !== 64) result.push(bitmap & 255);
  }

  return new Uint8Array(result);
}
