
import {Application} from "../src/application"


Application.initalize();

function tick(dt:number){
  Application.update(dt);
  Application.draw(dt);
  requestAnimationFrame(tick);
}


tick(0);

