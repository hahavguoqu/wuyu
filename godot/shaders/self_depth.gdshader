shader_type spatial;
render_mode unshaded, cull_back;
uniform vec3 view_origin;
varying float distance_along_ray;
void vertex() {
    vec3 world = (MODEL_MATRIX * vec4(VERTEX,1.0)).xyz;
    distance_along_ray=dot(view_origin-world,vec3(0.57735026919))/100.0;
}
void fragment() {
    vec3 packed=fract(clamp(distance_along_ray,0.0,0.9999)*vec3(1.0,255.0,65025.0));
    packed-=packed.yzz*vec3(1.0/255.0,1.0/255.0,0.0);
    ALBEDO=packed;
}
