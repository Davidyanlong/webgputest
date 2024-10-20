
import {Application} from "../src/application"
import { Destroy } from "./destroy";




function tick(dt:number){
  Application.update(dt);
  Application.draw(dt);
  requestAnimationFrame(tick);
}


Application.initalize().then(()=>{
  // 确保引擎初始化完成再启动更行与绘制工作
  tick(0);
  Destroy.initialize()
});

