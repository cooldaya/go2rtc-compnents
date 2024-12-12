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

// 发布订阅
type Callback = (data: any) => void;
export class Mitt {
  private events: { [key: string]: Callback[] };

  constructor() {
    this.events = {};
  }

  // 订阅事件
  on(eventName: string, callback: Callback): void {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  // 取消订阅事件
  off(eventName: string, callback: Callback): void {
    if (this.events[eventName]) {
      const index = this.events[eventName].indexOf(callback);
      if (index !== -1) {
        this.events[eventName].splice(index, 1);
      }
    }
  }

  // 发布事件
  emit(eventName: string, data: any): void {
    const event = this.events[eventName];
    if (event) {
      event.forEach(callback => callback(data));
    }
  }
}

// go2rtc mse ws管理器
export class Go2RtcMseWsManager extends Mitt {
  constructor() {
    super();
  }

  private mseWsMap = new Map<
    string,
    {
      ws: WebSocket;
      url: string;
      name: string;
      mime: Promise<string>;
      // 媒体数据
    }
  >();

  requestMseWs(url: string, name: string) {
    if (this.mseWsMap.has(name)) {
      // 已存在， 需要给新的video 发送mime信息，但是需要等待之前创建的ws获取到mime信息
      const mseWs = this.mseWsMap.get(name);
      mseWs.mime.then(mime => this.emit(this.getMimeEventType(name), mime)); // 重新发送mime信息
      return;
    }

    const mseWs = this.initMseWs(url, name);

    this.mseWsMap.set(name, {
      ws: mseWs,
      url,
      name,
      mime: new Promise(resolve => {
        this.on(this.getMimeEventType(name), mine => {
          resolve(mine);
        });
      }), // 然后续的video 等待mime信息,
    });

    return true;
  }

  private initMseWs(url: string, name: string): WebSocket {
    console.log('initMseWs', url, name);
    const mseWs = new WebSocket(url);
    mseWs.binaryType = 'arraybuffer';
    mseWs.onopen = () => {
      mseWs.send(
        JSON.stringify({
          type: 'mse',
          value: 'avc1.640029,avc1.64002A,avc1.640033,hvc1.1.6.L153.B0,mp4a.40.2,mp4a.40.5,flac,opus',
        }),
      );
    };
    mseWs.onmessage = ev => {
      const data = ev.data;
      if (typeof data === 'string') {
        // json 消息， 其中包含 mime的类型
        const jsonData = JSON.parse(data);
        const mime = jsonData.value;
        this.emit(this.getMimeEventType(name), mime);
        console.log('emit mse-mime', mime); // 存储更新 mime
      } else {
        // 二进制消息， 其中包含媒体数据
        this.emit(this.getArrayDataEventType(name), data);
      }
    };

    return mseWs;
  }

  getMimeEventType(name: string) {
    return `${name}-mse-mime`;
  }
  getArrayDataEventType(name: string) {
    return `${name}-mse-arraybuffer-data`;
  }
}
