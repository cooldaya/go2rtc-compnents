import { Component, Prop, h } from '@stencil/core';
import { simpleHash, Go2RtcMseWsManager } from '../../utils/funcs';

const mseUrlMap: Map<
  string,
  {
    src: string;
    name: string;
  }
> = new Map([]);

const go2RtcMseWsManager = new Go2RtcMseWsManager();

let i = 0;
@Component({
  tag: 'my-component',
  styleUrl: 'my-component.css',
  shadow: true,
})
export class MyComponent {
  /**
   * The last name
   */
  @Prop() src: string;

  @Prop() host: string = window.location.hostname;

  @Prop() port: string = '1984';

  @Prop() apiUrl: string = `http://${this.host}:${this.port}/api`;

  @Prop() authName: string = 'admin';
  @Prop() authPass: string = '123456';

  private num: number = ++i;

  private mseInfo;
  private videoEl: HTMLVideoElement;
  private mse = new MediaSource();
  private mseSourceBuffer: SourceBuffer;
  private mseStreamStarted: boolean = false;
  private mseQueue: Array<ArrayBuffer> = [];

  private apis = {
    addStream: (src, name) => {
      const params = new URLSearchParams();
      params.append('src', src);
      params.append('name', name);

      return fetch(`${this.apiUrl}/streams?${params.toString()}`, {
        method: 'PUT',
        headers: {
          Authorization: this.apis.getAuthorization(),
        },
      });
    },
    removeStream: name => {
      const params = new URLSearchParams();
      params.append('src', name);
      return fetch(`${this.apiUrl}/streams?${params.toString()}`, {
        method: 'DELETE',
      });
    },
    getAuthorization: () => {
      const credentials = btoa(`${this.authName}:${this.authPass}`);
      return `Basic ${credentials}`;
    },
    getMesWsUrl: name => {
      //ws://127.0.0.1:1984/api/ws?src=ca1
      return `ws://${this.host}:${this.port}/api/ws?src=${name}`;
    },
  };

  private async startTransStream() {
    const src = this.src;
    let mseInfo = mseUrlMap.get(src);
    if (!mseInfo) {
      mseInfo = {
        src,
        name: simpleHash(src),
      };
      mseUrlMap.set(src, mseInfo);
      this.apis.addStream(mseInfo.src, mseInfo.name);
      this.mseInfo = mseInfo;
      return;
    }
    this.mseInfo = mseInfo;
  }

  private playStream(mseInfo) {
    this.videoEl.src = URL.createObjectURL(this.mse);
    this.videoEl.muted = true;
    // this.videoEl.autoplay = true;
    this.videoEl.play();

    const go2rmws = go2RtcMseWsManager;

    this.mse.addEventListener('sourceopen', () => {
      // start ws connection
      go2rmws.requestMseWs(this.apis.getMesWsUrl(mseInfo.name), mseInfo.name);
    });

    // 监听获取 mime 类型
    go2rmws.on(go2rmws.getMimeEventType(mseInfo.name), (mime: string) => {
      if (this.mseSourceBuffer) return; // 防止重复创建 SourceBuffer
      this.mseSourceBuffer = this.mse.addSourceBuffer(mime);
      this.mseSourceBuffer.mode = 'segments';
      this.mseSourceBuffer.addEventListener('updateend', this.pushPacket.bind(this));
    });

    // 监听获取 arraybuffer 数据
    go2rmws.on(go2rmws.getArrayDataEventType(mseInfo.name), this.readPacket.bind(this));
  }

  private pushPacket() {
    // if (this.mse.readyState !== 'open') return;


    if(this.num === 2){
      console.log('num=2');
      // debugger;
    }

    if (!this.mse || this.mse.readyState !== 'open' || !this.mseSourceBuffer) return;
    // 设置进度条 数据读取进度
    // console.log('pushPacket');

    if (this.mseSourceBuffer && !this.mseSourceBuffer.updating) {
      if (this.mseQueue.length) {
        this.mseSourceBuffer.appendBuffer(this.mseQueue.shift());
        this.mseStreamStarted = true;
      } else {
        this.mseStreamStarted = false;
      }
    }
    if (this.videoEl && this.videoEl.buffered != null && this.videoEl.buffered.length > 0) {
      // 判断视频缓冲区时候有数据
      if (typeof document.hidden !== 'undefined' && document.hidden) {
        this.videoEl.currentTime = this.videoEl.buffered.end(this.videoEl.buffered.length - 1) - 0.5;
      }
    }
  }

  private readPacket(arraybuffer: ArrayBuffer) {
    if (this.num === 2) {
      console.log(this.mseStreamStarted,this.mseSourceBuffer.updating,'num=2')
      // debugger;
    }
    // const arraybuffer = this.cloneArrayBuffer(rawArrayBuffer);

    // if (this.mse.readyState !== 'open') return;

    // 压入数据进缓存区
    if (!this.mseSourceBuffer) {
      console.warn('mseSourceBuffer is null');
      return;
    }
    // SourceBuffer当没有处理数据包时，追加数据包

    if (!this.mseStreamStarted) {
      try {
        this.mseSourceBuffer.appendBuffer(arraybuffer);
        console.log('appendBuffer success', this.mseInfo.name, 'num='+this.num);
        this.mseStreamStarted = true;
      } catch (e) {
        console.warn('error, mseSourceBuffer appendBuffer error');
        this.mseStreamStarted = false;
      }

      return;
    }

    // SourceBuffer当有处理数据包时，追加数据包到队列
    this.mseQueue.push(arraybuffer);
    if (!this.mseSourceBuffer.updating) {
      this.pushPacket(); // 如果 SourceBuffer 没有在更新，则从队列中取出数据包并追加
    }
  }

  private async stopTransStream() {
    const mseInfo = mseUrlMap.get(this.src);
    if (mseInfo) {
      this.apis.removeStream(mseInfo.name);
    }
  }

  private initVideoElEvents() {
    this.videoEl.addEventListener('pause', () => {
      const videoEl = this.videoEl;
      if (!videoEl.buffered) return;
      if (videoEl.currentTime >= videoEl.buffered.end(videoEl.buffered.length - 1)) {
        videoEl.currentTime = videoEl.buffered.end(videoEl.buffered.length - 1) - 0.5;
        videoEl.play();
      }
    });
  }

  componentWillLoad() {
    return this.startTransStream();
  }

  render() {
    return <video ref={el => (this.videoEl = el as HTMLVideoElement)}>Hello, World! I'm </video>;
  }

  componentDidLoad() {
    this.playStream(this.mseInfo);
    this.initVideoElEvents();
  }

  disconnectedCallback() {
    this.stopTransStream();
  }
}
