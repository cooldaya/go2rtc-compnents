import { Component, Prop, h } from '@stencil/core';
import { simpleHash } from '../../utils/funcs';
import '../../utils/video-stream';

const mseUrlMap: Map<
  string,
  {
    src: string;
    name: string;
    num: number;
  }
> = new Map([]);

@Component({
  tag: 'rtsp-video',
  styleUrl: 'rtsp-video.css',
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

  @Prop() mode: string = 'random'; // webrtc,mse,random

  private mseInfo;

  private apis = {
    addStream: (src, name) => {
      const params = new URLSearchParams();
      params.append('src', src);
      params.append('name', name);

      const url = new URL(`${this.apiUrl}/streams?${params.toString()}`);
      return fetch(url, {
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
      const username = this.authName;
      const password = this.authPass;
      if (username && password) {
        return 'Basic ' + btoa(username + ':' + password);
      }
      return '';
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
        num: 1,
      };
      mseUrlMap.set(src, mseInfo);
      this.apis.addStream(mseInfo.src, mseInfo.name);
      this.mseInfo = mseInfo;
      return;
    }
    this.mseInfo = mseInfo;
    mseInfo.num++;
  }

  private async stopTransStream() {
    const mseInfo = mseUrlMap.get(this.src);
    if(!mseInfo) return console.warn('mseInfo not found');
    mseInfo.num--;
    if(mseInfo.num <1){
      this.apis.removeStream(mseInfo.name);
      mseUrlMap.delete(this.src);
    }
  }

  private getVideoStreamUrl() {
    const mseInfo = this.mseInfo;
    const url = new URL(`api/ws?src=${mseInfo.name}`, this.apiUrl);
    url.username = this.authName;
    url.password = this.authPass;

    return url;
  }

  private getMode(): string {
    if (['webrtc', 'mse'].includes(this.mode)) {
      return this.mode;
    }
    return Math.random() < 0.5 ? 'webrtc' : 'mse';
  }

  componentWillLoad() {
    return this.startTransStream();
  }

  render() {
    return (
      <video-stream src={this.getVideoStreamUrl()} mode={this.getMode()}>
        {' '}
      </video-stream>
    );
  }

  componentDidLoad() {}

  disconnectedCallback() {
    this.stopTransStream();
  }
}
