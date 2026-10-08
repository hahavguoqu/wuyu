shader_type canvas_item;
uniform vec4 top_color : source_color;
uniform vec4 bottom_color : source_color;
void fragment() {
    float v=UV.y;
    vec3 c=mix(top_color.rgb,bottom_color.rgb,smoothstep(0.0,1.0,v));
    float haze=exp(-dot(UV-vec2(0.68,0.55),UV-vec2(0.68,0.55))*9.0)*0.05;
    COLOR=vec4(c+haze,1.0);
}
