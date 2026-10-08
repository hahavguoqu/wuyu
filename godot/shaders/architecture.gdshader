shader_type spatial;
render_mode unshaded, cull_back;

uniform vec4 top_color : source_color = vec4(1.0);
uniform vec4 x_color : source_color = vec4(1.0);
uniform vec4 z_color : source_color = vec4(1.0);
uniform bool face_shading = true;
uniform float angle = 0.0;
uniform float depth_offset = 0.0;
uniform vec4 ramp_a = vec4(0.0,1.0,0.0,0.0);
uniform vec4 ramp_b = vec4(0.0,1.0,0.0,0.0);
uniform vec4 gate_a = vec4(0.0,1.0,0.0,-1.0);
uniform vec4 gate_b = vec4(0.0,1.0,0.0,-1.0);
uniform float upright_a = 0.0;
uniform float upright_b = 0.0;
uniform bool traveller = false;
uniform float carrier_floor = 0.0;
uniform bool self_masked = false;
uniform sampler2D self_mask : filter_nearest, repeat_disable;
uniform vec3 view_origin = vec3(18.0,20.0,18.0);
varying vec3 face_color;
varying float original_distance;
const vec3 RAY = vec3(0.57735026919);

float ramp(vec3 p,vec4 r) {
    float v = r.x < 0.5 ? p.x : (r.x < 1.5 ? p.y : p.z);
    return r.w * clamp((v-r.z)/(r.y-r.z),0.0,1.0);
}
float profile(vec3 p) {
    float a = ramp(p,ramp_a) * (gate_a.w<0.0 ? 1.0 : ramp(p,gate_a));
    float b = ramp(p,ramp_b) * (gate_b.w<0.0 ? 1.0 : ramp(p,gate_b));
    if(upright_a>0.0) a *= pow(max(0.0,1.0-sin(angle)),upright_a);
    if(upright_b>0.0) b *= pow(max(0.0,1.0-sin(angle)),upright_b);
    return depth_offset + a + b;
}
void vertex() {
    vec3 world = (MODEL_MATRIX * vec4(VERTEX,1.0)).xyz;
    original_distance = dot(view_origin-world,RAY)/100.0;
    vec3 sample_point = world;
    if(traveller) sample_point -= vec3(world.y-carrier_floor);
    vec3 displaced = world + vec3(profile(sample_point));
    POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(displaced,1.0);
    vec3 n = normalize(MODEL_NORMAL_MATRIX * NORMAL);
    float t = max(0.0,n.y), x = abs(n.x), z = abs(n.z);
    face_color = face_shading ? (top_color.rgb*t+x_color.rgb*x+z_color.rgb*z)/max(t+x+z,0.0001) : top_color.rgb;
    if(face_shading && n.y < -0.99) face_color = z_color.rgb;
}
void fragment() {
    if(self_masked) {
        vec3 packed = texture(self_mask,SCREEN_UV).rgb;
        float nearest = dot(packed,vec3(1.0,1.0/255.0,1.0/65025.0));
        // The mask samples pixel centres; MSAA samples the visible surface at
        // sub-pixel positions. Bound the tolerance by this surface's gradient.
        float tolerance=max(0.00002,fwidth(original_distance)*2.0);
        if(original_distance>nearest+tolerance) discard;
    }
    ALBEDO = face_color;
}
