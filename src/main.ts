
import {Application} from "../src/application"


Application.initalize();

function tick(){
  Application.update();
  Application.draw();
  requestAnimationFrame(tick);
}


tick();

