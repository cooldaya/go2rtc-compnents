import { Component, Prop, h } from '@stencil/core';
import { simpleHash } from '../../utils/funcs';

const mseUrlMap: Map<
  string,
  {
    src: string;
    name: string;
  }
> = new Map([]);

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

  private videoEl: HTMLVideoElement;
  private mse = new MediaSource();
  private mseSourceBuffer: SourceBuffer;
  private mseStreamStarted:boolean = false;
  private mseQueue: Array<ArrayBuffer> = [];

  



  private apis = {
    addStream: (src, name) => {
      const params = new URLSearchParams();
      params.append('src', src);
      params.append('name', name);

      console.log(this.apis.getAuthorization());
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
      return this.apis.addStream(mseInfo.src, mseInfo.name);
    }
  }

  private async stopTransStream() {
    const mseInfo = mseUrlMap.get(this.src);
    if (mseInfo) {
      this.apis.removeStream(mseInfo.name);
    }
  }

  componentWillLoad() {
    return this.startTransStream();
  }

  render() {
    return <video ref={el => (this.videoEl = el as HTMLVideoElement)}>Hello, World! I'm </video>;
  }

  componentDidLoad() {
    console.log(this.videoEl, this.apiUrl);
  }

  disconnectedCallback() {
    this.stopTransStream();
  }
}
