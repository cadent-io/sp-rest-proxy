import { ProxyUtils } from '../utils';
import { IProxyContext, IProxySettings } from '../interfaces';
import { ISPRequest } from 'sp-request';
import * as fs from 'fs';
import { Download, IAuthOptions } from 'sp-download';
import * as path from 'path';
import { Cpass } from 'cpass';
import { Request, Response, NextFunction } from 'express';

export class RestGetRouter {

  private spr: ISPRequest;
  private ctx: IProxyContext;
  private settings: IProxySettings;
  private util: ProxyUtils;

  constructor (context: IProxyContext, settings: IProxySettings) {
    this.ctx = context;
    this.settings = settings;
    this.util = new ProxyUtils(this.ctx);
  }

  public router = (req: Request, res: Response, next?: NextFunction) => {
    let endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.spr = this.util.getCachedRequest(this.spr);

    if (!this.settings.silentMode) {
      console.log('\nGET: ' + endpointUrl);
    }

    let requestHeadersPass: any = {};

    let ignoreHeaders = [
      'host', 'referer', 'origin',
      'if-none-match', 'connection', 'cache-control', 'user-agent',
      'accept-encoding', 'x-requested-with', 'accept-language'
    ];

    Object.keys(req.headers).forEach((prop: string) => {
      if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          requestHeadersPass.Accept = req.headers[prop];
        } else if (prop.toLowerCase() === 'content-type') {
          requestHeadersPass['Content-Type'] = req.headers[prop];
        } else {
          requestHeadersPass[prop] = req.headers[prop];
        }
      }
    });

    if (this.settings.debugOutput) {
      console.log('\nHeaders:');
      console.log(JSON.stringify(req.headers, null, 2));
    }

   if(endpointUrl.indexOf('GetFileByServerRelativeUrl') !== -1) {

    let ret = ""
    if ( /'/.test( endpointUrl ) ){
      ret = endpointUrl.match( /'(.*?)'/ )[1];
    } else {
      ret = endpointUrl;
    }
    ret = ret.replace(/%20/g, " ")
    
    var fileName = ret.split("/").pop();

    const cpass = new Cpass();
    let context: IAuthOptions;
    context = require(path.resolve("./config/private.json"));
    (context as any).password = (context as any).password && cpass.decode((context as any).password);
    const download = new Download(context);

    let filePathToDownload: string = "https://chatspaceio.sharepoint.com"+ret //sites/ChatSpace/Shared Documents/test doc.docx"
    
    let saveToPath: string = 'files/';
    

    download.downloadFile(filePathToDownload, saveToPath)
      .then(savedToPath => {
        console.log(`File has been downloaded to ${savedToPath}`);
        res.sendFile(fileName, { root: path.join(__dirname, '../../files') });
      })
      .catch(error => {
        console.log(error);
      });


   }
   else {
    this.spr.get(endpointUrl, {
      headers: requestHeadersPass,
      agent: this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined
    })
      .then((response: any) => {
        if (this.settings.debugOutput) {
          console.log(response.statusCode, response.body);
        }
        res.status(response.statusCode);
        //if(response.headers["content-type"] == "application/octet-stream") {
        res.json(response.body);
        
      })
      .catch((err: any) => {
        res.status(err.statusCode >= 100 && err.statusCode < 600 ? err.statusCode : 500);
        res.send(err.message);
      });
    }
  }
}
