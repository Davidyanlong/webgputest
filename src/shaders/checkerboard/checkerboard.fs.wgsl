@fragment fn fs(
// @builtin(position) 数据的区间是[0,300] 屏幕坐标
@builtin(position) pixelPosition : vec4f,
@location(1) @interpolate(linear) z : f32,
) -> @location(0) vec4f {
    let red = vec4f(1, 0, 0, 1);
    let cyan = vec4f(0, 1, 1, 1);
    let grid = vec2u(pixelPosition.xy) / 8;
    let checker = (grid.x + grid.y) % 2 == 1;

    return select(red, cyan, checker);
}
