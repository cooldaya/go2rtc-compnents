export function simpleHash(str: string): string {
  if (typeof str !== 'string' || str.length === 0) throw new Error('Input must be a string');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    hash = (hash << 5) - hash + charCode; // 使用左移和加法来增加复杂性
    hash |= 0; // 将浮点转换为整数（确保结果是一个整数）
  }
  return (hash >>> 0).toString(32); // 返回最终的无符号哈希值
}

