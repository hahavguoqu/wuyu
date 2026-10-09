class_name GateOptics
extends RefCounted

const VIEW_RAY := Vector3(0.57735026919,0.57735026919,0.57735026919)

static func axis(level: Dictionary) -> Vector3:
	return Vector3.RIGHT if level.axis=="x" else (Vector3.UP if level.axis=="y" else Vector3.BACK)

static func rotation(level: Dictionary,angle: float) -> Quaternion:
	return Quaternion(axis(level),angle*float(level.get("sign",1)))

static func v(a: Array) -> Vector3:
	return Vector3(float(a[0]),float(a[1]),float(a[2]))

static func weight(r: Dictionary,p: Vector3) -> float:
	var coordinate: float = p.x if r.axis=="x" else (p.y if r.axis=="y" else p.z)
	return clampf((coordinate-float(r.end))/(float(r.start)-float(r.end)),0.0,1.0)

static func depth(level: Dictionary,part: String,p: Vector3,angle: float) -> float:
	var spec: Dictionary = level.get("opticalDepths",{}).get(part,{})
	var result: float = float(spec.get("offset",0))
	for r: Dictionary in spec.get("ramps",[]):
		var amplitude: float = float(r.amount)
		if r.has("uprightPower"):
			amplitude *= pow(maxf(0.0,1.0-sin(angle)),float(r.uprightPower))
		result += amplitude * weight(r,p) * (weight(r.gate,p) if r.has("gate") else 1.0)
	return result

static func encode(r: Dictionary,amount: float) -> Vector4:
	return Vector4(0 if r.axis=="x" else (1 if r.axis=="y" else 2),float(r.start),float(r.end),amount)

static func material_profile(material: ShaderMaterial,level: Dictionary,part: String) -> void:
	var spec: Dictionary = level.get("opticalDepths",{}).get(part,{})
	material.set_shader_parameter("depth_offset",float(spec.get("offset",0)))
	var ramps: Array = spec.get("ramps",[])
	for i in range(2):
		var suffix: String = "a" if i==0 else "b"
		material.set_shader_parameter("ramp_"+suffix,Vector4(0,1,0,0))
		material.set_shader_parameter("gate_"+suffix,Vector4(0,1,0,-1))
		material.set_shader_parameter("upright_"+suffix,0.0)
		if i < ramps.size():
			var r: Dictionary = ramps[i]
			material.set_shader_parameter("ramp_"+suffix,encode(r,float(r.amount)))
			material.set_shader_parameter("upright_"+suffix,float(r.get("uprightPower",0)))
			if r.has("gate"):
				material.set_shader_parameter("gate_"+suffix,encode(r.gate,1.0))

static func part(level: Dictionary,segment: String) -> String:
	for road: Dictionary in level.paths:
		if segment==road.id or segment.begins_with(str(road.id)+"-"):
			return road.id
	return ""
