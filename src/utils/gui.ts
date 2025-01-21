import GUI from 'muigui'

export const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };


export const limitOptionsFn = (min = 0, max = 90, minRange = 1, step = 1) => ({ min, max, minRange, step, converters: GUI.converters.radToDeg });

export const initGUI = (parent: HTMLElement | undefined) => {
    const gui = new GUI({
        parent,
        width: '145px'
    })
    gui.domElement.style.top = '-300px';
    gui.domElement.style.left = '150px';

    return gui;
}
