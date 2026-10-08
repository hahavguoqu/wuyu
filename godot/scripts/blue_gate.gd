extends Node3D

const Optics = preload("res://scripts/optics.gd")
const Navigation = preload("res://scripts/navigation.gd")
const ARCH_SHADER = preload("res://shaders/architecture.gdshader")
const MASK_SHADER = preload("res://shaders/self_depth.gdshader")
const BG_SHADER = preload("res://shaders/background.gdshader")
const DATA_PATH := "res://data/blue_gate.json"
const SPEED := 2.175
const RAY := Vector3(0.57735026919,0.57735026919,0.57735026919)

var level: Dictionary
var data: Dictionary
var navigation: RefCounted
var architecture: Node3D
var mechanism: Node3D
var crank: Node3D
var actor: Node3D
var camera: Camera3D
var meshes: Array[MeshInstance3D] = []
var actor_meshes: Array[MeshInstance3D] = []
var masks: Dictionary = {}
var colliders: Array[Dictionary] = []
var location: Dictionary = {"segment":"west-road","t":0.0}
var angle: float = PI/2.0
var route: Array = []
var leg_index: int = 0
var leg_time: float = 0.0
var elapsed: float = 0.0
var won: bool = false
var snap: Tween
var drag: Dictionary = {}
var pointer_start: Vector2
var clicked_road: Dictionary = {}
var goal_mark: Control
var completion: Control
var hud: CanvasLayer
var state_label: Label
var frame_target: Vector3
var qa_mode: bool = false
var last_web_state: String = ""

func _ready() -> void:
	data=JSON.parse_string(FileAccess.get_file_as_string(DATA_PATH))
	level=data.level
	navigation=Navigation.new(level)
	var args: PackedStringArray=OS.get_cmdline_user_args()
	if "--bake" in args:
		for name: String in ["Architecture","Traveller"]:
			var previous: Node=get_node_or_null(name)
			if previous!=null:previous.free()
	architecture=get_node_or_null("Architecture")
	if architecture==null:
		architecture=import_node(data.architecture)
		architecture.name="Architecture";add_child(architecture)
	actor=get_node_or_null("Traveller")
	if actor==null:
		actor=import_node(data.traveller)
		add_child(actor)
	mechanism=architecture.get_node("Mechanism")
	crank=architecture.find_child("Crank",true,false)
	collect_meshes(architecture,meshes)
	collect_meshes(actor,actor_meshes)
	if "--bake" in args:
		apply_pose(PI/2.0);bake_scene();return
	qa_mode="--verify" in args or "--capture" in args
	make_camera();make_masks();make_ui()
	get_viewport().size_changed.connect(resize)
	resize();apply_pose(angle)
	if OS.has_feature("web"):
		JavaScriptBridge.eval("document.getElementById('canvas').setAttribute('aria-label','第三关 门阶：点击道路移动，拖动旋钮旋转。')")
	if "--verify" in args:
		verify();return
	if "--capture" in args:
		capture_sequence.call_deferred()

func import_node(spec: Dictionary) -> Node3D:
	var n: Node3D=MeshInstance3D.new() if spec.has("mesh") else Node3D.new()
	var roads: Array=spec.get("mesh",{}).get("roads",[])
	n.name=str(spec.name) if roads.is_empty() else "Road_"+str(roads[0]).replace("-","_")
	n.position=Optics.v(spec.position)
	var q: Array=spec.quaternion
	n.quaternion=Quaternion(float(q[0]),float(q[1]),float(q[2]),float(q[3]))
	n.scale=Optics.v(spec.scale)
	if spec.has("mesh"):
		var encoded: Dictionary=spec.mesh
		var positions := PackedVector3Array();var normals := PackedVector3Array();var indices := PackedInt32Array()
		for i in range(0,encoded.vertices.size(),3):
			positions.append(Vector3(float(encoded.vertices[i]),float(encoded.vertices[i+1]),float(encoded.vertices[i+2])))
			normals.append(Vector3(float(encoded.normals[i]),float(encoded.normals[i+1]),float(encoded.normals[i+2])))
		for i in range(0,encoded.indices.size(),3):
			# Godot front faces are clockwise; Three.js exports counterclockwise.
			indices.append(int(encoded.indices[i]));indices.append(int(encoded.indices[i+2]));indices.append(int(encoded.indices[i+1]))
		var arrays: Array=[];arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX]=positions;arrays[Mesh.ARRAY_NORMAL]=normals;arrays[Mesh.ARRAY_INDEX]=indices
		var geometry := ArrayMesh.new();geometry.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
		n.mesh=geometry
		var material := ShaderMaterial.new();material.shader=ARCH_SHADER
		for i in range(3):
			material.set_shader_parameter(["top_color","x_color","z_color"][i],Color(encoded.palette[i]))
		material.set_shader_parameter("face_shading",encoded.face_shading)
		Optics.material_profile(material,level,encoded.part)
		n.material_override=material
		for key: String in ["roads","part","self_part","control","collider"]:
			n.set_meta(key,encoded[key])
	for child: Dictionary in spec.children:
		n.add_child(import_node(child))
	return n

func collect_meshes(root: Node,out: Array[MeshInstance3D]) -> void:
	if root is MeshInstance3D:
		out.append(root)
		if root.has_meta("collider"):
			var bounds: Dictionary=root.get_meta("collider")
			var lo: Vector3=Optics.v(bounds.min);var hi: Vector3=Optics.v(bounds.max)
			colliders.append({"node":root,"center":(lo+hi)/2.0,"half":(hi-lo)/2.0-Vector3.ONE*0.002,"moving":mechanism.is_ancestor_of(root)})
	for child: Node in root.get_children():collect_meshes(child,out)

func bake_scene() -> void:
	var root := Node3D.new();root.name="Architecture"
	remove_child(architecture)
	for child: Node in architecture.get_children():
		architecture.remove_child(child);root.add_child(child)
	set_owner_recursive(root,root)
	var packed := PackedScene.new();packed.pack(root)
	var err: Error=ResourceSaver.save(packed,"res://scenes/architecture.tscn")
	print("BAKE architecture: ",error_string(err))
	root.free();architecture.free()
	var traveller_scene := PackedScene.new();set_owner_recursive(actor,actor);traveller_scene.pack(actor)
	err=ResourceSaver.save(traveller_scene,"res://scenes/traveller.tscn")
	print("BAKE traveller: ",error_string(err))
	get_tree().quit(0 if err==OK else 1)

func set_owner_recursive(node: Node,root: Node) -> void:
	for child: Node in node.get_children():
		child.owner=root;set_owner_recursive(child,root)

func make_camera() -> void:
	camera=get_node_or_null("FixedCamera")
	if camera==null:
		camera=Camera3D.new();camera.name="FixedCamera";add_child(camera)
	camera.projection=Camera3D.PROJECTION_ORTHOGONAL;camera.near=0.1;camera.far=100;camera.current=true
	var world_environment := WorldEnvironment.new();var environment := Environment.new()
	environment.background_mode=Environment.BG_CANVAS;environment.background_canvas_max_layer=-1
	environment.tonemap_mode=Environment.TONE_MAPPER_LINEAR
	world_environment.environment=environment;add_child(world_environment)

func make_masks() -> void:
	for part: String in level.opticalDepths:
		if level.opticalDepths[part].get("ramps",[]).is_empty():continue
		var viewport := SubViewport.new();viewport.name="SelfDepth_"+part
		viewport.own_world_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
		viewport.msaa_3d=Viewport.MSAA_DISABLED;add_child(viewport)
		var mask_camera := Camera3D.new();mask_camera.projection=Camera3D.PROJECTION_ORTHOGONAL
		mask_camera.near=camera.near;mask_camera.far=camera.far;viewport.add_child(mask_camera);mask_camera.current=true
		var environment := Environment.new();environment.background_mode=Environment.BG_COLOR;environment.background_color=Color.WHITE
		var world_environment := WorldEnvironment.new();world_environment.environment=environment;viewport.add_child(world_environment)
		var mask_material := ShaderMaterial.new();mask_material.shader=MASK_SHADER
		var copies: Array[Dictionary]=[]
		for mesh: MeshInstance3D in meshes:
			if str(mesh.get_meta("self_part",""))!=part:continue
			var ghost := MeshInstance3D.new();ghost.mesh=mesh.mesh;ghost.transform=mesh.global_transform;ghost.material_override=mask_material;viewport.add_child(ghost)
			copies.append({"source":mesh,"copy":ghost})
			mesh.material_override.set_shader_parameter("self_masked",true)
			mesh.material_override.set_shader_parameter("self_mask",viewport.get_texture())
		var actor_copy: Node3D=actor.duplicate();viewport.add_child(actor_copy)
		set_mask_material(actor_copy,mask_material)
		masks[part]={"viewport":viewport,"camera":mask_camera,"material":mask_material,"copies":copies,"actor":actor_copy}

func set_mask_material(root: Node,material: Material) -> void:
	if root is MeshInstance3D:root.material_override=material
	for child: Node in root.get_children():set_mask_material(child,material)

func make_ui() -> void:
	var background_layer := CanvasLayer.new();background_layer.layer=-1;add_child(background_layer)
	var background := ColorRect.new();background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);background.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var bg_material := ShaderMaterial.new();bg_material.shader=BG_SHADER;bg_material.set_shader_parameter("top_color",Color(level.top));bg_material.set_shader_parameter("bottom_color",Color(level.bottom))
	background.material=bg_material;background_layer.add_child(background)
	hud=CanvasLayer.new();hud.name="Interface";add_child(hud)
	var title := Label.new();title.text="III";title.position=Vector2(24,18);title.modulate=Color(1,1,1,0.6);title.add_theme_font_size_override("font_size",19);hud.add_child(title)
	var reset := Button.new();reset.name="Restart";reset.icon=load("res://assets/restart.svg");reset.position=Vector2(1032,16);reset.size=Vector2(44,44)
	reset.add_theme_constant_override("icon_max_width",24);reset.expand_icon=true;reset.flat=true;reset.modulate=Color(1,1,1,0.65);reset.pressed.connect(restart);hud.add_child(reset)
	goal_mark=Control.new();goal_mark.mouse_filter=Control.MOUSE_FILTER_IGNORE;hud.add_child(goal_mark)
	completion=Control.new();completion.name="Completion";completion.visible=false;hud.add_child(completion)
	var replay := Button.new();replay.icon=load("res://assets/restart.svg");replay.add_theme_constant_override("icon_max_width",24);replay.expand_icon=true;replay.size=Vector2(64,56);replay.position=Vector2(66,0);replay.flat=true;replay.pressed.connect(restart);completion.add_child(replay)
	var star := TextureRect.new();star.texture=load("res://assets/star.svg");star.position=Vector2(16,12);star.size=Vector2(32,32);star.mouse_filter=Control.MOUSE_FILTER_IGNORE;completion.add_child(star)
	state_label=Label.new();state_label.name="VerificationState";state_label.visible=qa_mode;state_label.position=Vector2(20,64);state_label.add_theme_font_size_override("font_size",14);hud.add_child(state_label)

func resize() -> void:
	var size: Vector2=get_viewport().get_visible_rect().size
	var target := Vector3(0,2,0)
	camera.position=target+Vector3(18,18,18);camera.look_at(target)
	var right: Vector3=camera.global_basis.x;var up: Vector3=camera.global_basis.y
	var lo := Vector2(INF,INF);var hi := Vector2(-INF,-INF)
	for a: Array in data.frame_points:
		var p: Vector3=Optics.v(a)-target
		var xy := Vector2(p.dot(right),p.dot(up));lo=lo.min(xy);hi=hi.max(xy)
	target+=right*(lo.x+hi.x)/2.0+up*(lo.y+hi.y)/2.0
	var aspect: float=size.x/size.y
	var available_h: float=maxf(0.7,(size.y-(130.0 if size.x<600.0 else 110.0))/size.y)
	var available_w: float=maxf(0.8,(size.x-48.0)/size.x)
	camera.size=maxf(maxf((hi.y-lo.y+0.75)/available_h,(hi.x-lo.x+0.65)/aspect/available_w),6.4)
	target-=up*camera.size*(0.035 if size.x<600.0 else 0.015)
	frame_target=target;camera.position=target+Vector3(18,18,18);camera.look_at(target)
	for mask: Dictionary in masks.values():
		mask.viewport.size=Vector2i(size)
		mask.camera.transform=camera.transform;mask.camera.size=camera.size
		mask.material.set_shader_parameter("view_origin",camera.position)
	for mesh: MeshInstance3D in meshes+actor_meshes:mesh.material_override.set_shader_parameter("view_origin",camera.position)
	if hud:
		hud.get_node("Restart").position=Vector2(size.x-64.0,16.0)
		completion.position=Vector2((size.x-130.0)/2.0,size.y-110.0)

func apply_pose(value: float) -> void:
	angle=clampf(value,0.0,PI/2.0)
	mechanism.quaternion=Quaternion(Vector3(0,0,1),angle)
	crank.rotation.z=angle
	for mesh: MeshInstance3D in meshes+actor_meshes:mesh.material_override.set_shader_parameter("angle",angle)
	navigation.rebuild(angle);update_actor()
	for mask: Dictionary in masks.values():
		for copy: Dictionary in mask.copies:copy.copy.transform=copy.source.global_transform

func update_actor() -> void:
	actor.position=navigation.point(location)
	var segment: Dictionary=navigation.by_id[location.segment]
	var up: Vector3=segment.up
	var heading: float=float(actor.get_meta("heading",PI/4.0))
	actor.quaternion=Quaternion(Vector3.UP,up)*Quaternion(Vector3.UP,heading)
	var part: String=Optics.part(level,location.segment)
	for mesh: MeshInstance3D in actor_meshes:
		var material: ShaderMaterial=mesh.material_override
		material.set_shader_parameter("traveller",true);material.set_shader_parameter("carrier_floor",actor.position.y)
		Optics.material_profile(material,level,part)
		material.set_shader_parameter("self_masked",masks.has(part))
		if masks.has(part):material.set_shader_parameter("self_mask",masks[part].viewport.get_texture())
	for key: String in masks:
		var copy: Node3D=masks[key].actor;copy.visible=key==part;copy.transform=actor.transform
		for i in range(actor.get_child_count()):copy.get_child(i).transform=actor.get_child(i).transform
	if state_label:
		state_label.text="angle %.3f | %s %.3f | turns %d" % [angle,location.segment,float(location.t),int(get_meta("turns",0))]
	if OS.has_feature("web"):
		var state: String=JSON.stringify({"angle":snappedf(angle,0.001),"segment":location.segment,"position":snappedf(float(location.t),0.001),"turns":int(get_meta("turns",0)),"walking":not route.is_empty(),"won":won})
		if state!=last_web_state:
			last_web_state=state
			JavaScriptBridge.eval("Object.assign(document.getElementById('canvas').dataset,"+state+")")

func _process(delta: float) -> void:
	if navigation==null:return
	elapsed+=delta
	if not route.is_empty():walk(delta)
	var stride: float=sin(elapsed*11.0) if not route.is_empty() else 0.0
	actor.get_node("LeftLeg").rotation.x=stride*0.48;actor.get_node("RightLeg").rotation.x=-stride*0.48
	actor.get_node("Body").position.y=absf(cos(elapsed*11.0))*0.014 if not route.is_empty() else 0.0
	update_actor()

func walk(delta: float) -> void:
	var budget: float=delta
	while leg_index<route.size():
		var leg: Dictionary=route[leg_index]
		if leg.get("teleport",false):
			location=leg.end.duplicate();leg_index+=1;continue
		var length: float=leg.from.distance_to(leg.to)
		var duration: float=maxf(0.001,length/SPEED)
		var used: float=minf(budget,duration-leg_time);leg_time+=used;budget-=used
		var fraction: float=minf(1.0,leg_time/duration)
		location={"segment":leg.segment,"t":lerpf(float(leg.from_t),float(leg.to_t),fraction)}
		var direction: Vector3=leg.to-leg.from
		if Vector2(direction.x,direction.z).length()>0.001:actor.set_meta("heading",atan2(direction.x,direction.z))
		if fraction<1.0:break
		leg_index+=1;leg_time=0.0
		if budget<=0.0:break
	if leg_index>=route.size():
		route.clear()
		if location.segment==level.goalAnchor.segment and float(location.t)>0.999:
			won=true;completion.visible=true;print("GATE_COMPLETE turns=",get_meta("turns",0))

func go_to(anchor: Dictionary) -> void:
	if won or not drag.is_empty() or (snap!=null and snap.is_running()):return
	var next: Array=navigation.route(location,anchor)
	if not next.is_empty():route=next;leg_index=0;leg_time=0.0

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		if event.keycode==KEY_R:restart()
		if event.keycode==KEY_SPACE:route.clear()
	if event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT:
		if event.pressed:pointer_down(event.position)
		else:pointer_up(event.position)
	elif event is InputEventMouseMotion and not drag.is_empty():pointer_move(event.position)
	elif event is InputEventScreenTouch:
		if event.index!=0:return
		if event.pressed:pointer_down(event.position)
		else:pointer_up(event.position)
	elif event is InputEventScreenDrag and not drag.is_empty() and event.index==0:pointer_move(event.position)

func pointer_down(p: Vector2) -> void:
	if won or (snap!=null and snap.is_running()):return
	pointer_start=p;clicked_road={}
	var center: Vector2=camera.unproject_position(crank.global_position)
	if p.distance_to(center)<33.0:
		route.clear()
		drag={"center":center,"initial":angle,"last":(p-center).angle(),"delta":0.0,"circular":p.distance_to(center)>16.0,"moved":false}
		return
	var hit: Dictionary=pick(p)
	if not hit.is_empty():clicked_road=hit

func pointer_move(p: Vector2) -> void:
	if p.distance_to(pointer_start)>5.0:drag.moved=true
	if not drag.moved:return
	var next: float
	if drag.circular:
		var current: float=(p-drag.center).angle()
		drag.delta+=wrapf(current-float(drag.last),-PI,PI);drag.last=current
		next=float(drag.initial)-float(drag.delta)
	else:
		var delta: Vector2=p-pointer_start
		next=float(drag.initial)+(delta.x-delta.y*0.45)*PI/160.0
	apply_pose(safe_angle(angle,next))

func pointer_up(p: Vector2) -> void:
	if not drag.is_empty():
		var target: float=round(angle/(PI/2.0))*PI/2.0 if drag.moved else (0.0 if angle>PI/4.0 else PI/2.0)
		var initial: float=float(drag.initial)
		drag.clear();turn_to(target,initial)
	elif not clicked_road.is_empty() and p.distance_to(pointer_start)<7.0:
		go_to(clicked_road)
	clicked_road={}

func turn_to(target: float,initial: float=-1.0) -> void:
	if snap!=null:snap.kill()
	route.clear()
	if absf((angle if initial<0.0 else initial)-target)>0.001:set_meta("turns",int(get_meta("turns",0))+1)
	snap=create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	snap.tween_method(func(a: float):apply_pose(safe_angle(angle,a)),angle,target,0.35)

func pick(screen: Vector2) -> Dictionary:
	var origin: Vector3=camera.project_ray_origin(screen);var direction: Vector3=camera.project_ray_normal(screen)
	var hits: Array[Dictionary]=[];var interior: Dictionary={}
	for mesh: MeshInstance3D in meshes:
		var arrays: Array=mesh.mesh.surface_get_arrays(0)
		var vertices: PackedVector3Array=arrays[Mesh.ARRAY_VERTEX];var indices: PackedInt32Array=arrays[Mesh.ARRAY_INDEX]
		var transform_inverse: Transform3D=mesh.global_transform.affine_inverse()
		var local_origin: Vector3=transform_inverse*origin;var local_direction: Vector3=transform_inverse.basis*direction
		for i in range(0,indices.size(),3):
			var a: Vector3=vertices[indices[i]];var b: Vector3=vertices[indices[i+1]];var c: Vector3=vertices[indices[i+2]]
			# Winding was reversed on import; geometric outward normal is -cross.
			var normal: Vector3=(c-a).cross(b-a).normalized()
			if normal.dot(local_direction)>=0.0:continue
			var point: Variant=Geometry3D.ray_intersects_triangle(local_origin,local_direction,a,b,c)
			if point==null:continue
			var world: Vector3=mesh.global_transform*point
			var distance: float=origin.distance_to(world)
			var part: String=str(mesh.get_meta("part",""));var self_part: String=str(mesh.get_meta("self_part",""))
			if not self_part.is_empty():interior[self_part]=minf(float(interior.get(self_part,INF)),distance)
			var offset: float=Optics.depth(level,part,world,angle)
			hits.append({"mesh":mesh,"point":world,"normal":mesh.global_basis*normal,"original":distance,"distance":origin.distance_to(world+Vector3.ONE*offset),"self":self_part})
	hits=hits.filter(func(h):return h.self=="" or float(h.original)<=float(interior[h.self])+0.0001)
	hits.sort_custom(func(a,b):return a.distance<b.distance)
	if hits.is_empty():return {}
	var h: Dictionary=hits[0]
	# The emblem and its cube are one destination, even though their meshes
	# carry no road IDs. Preserve visible-depth picking before selecting it.
	if str(h.mesh.get_meta("part",""))=="goal-road":return level.goalAnchor.duplicate()
	if h.normal.y<=0.5:return {}
	return navigation.closest(h.point,h.mesh.get_meta("roads",[]))

func safe_angle(from: float,to: float) -> float:
	to=clampf(to,0.0,PI/2.0)
	var steps: int=maxi(1,int(ceil(absf(to-from)/0.015)))
	var safe: float=from
	for i in range(1,steps+1):
		var candidate: float=lerpf(from,to,float(i)/steps)
		mechanism.quaternion=Quaternion(Vector3(0,0,1),candidate)
		if colliding():break
		safe=candidate
	mechanism.quaternion=Quaternion(Vector3(0,0,1),safe)
	return safe

func colliding() -> bool:
	for moving: Dictionary in colliders:
		if not moving.moving:continue
		for fixed: Dictionary in colliders:
			if fixed.moving:continue
			if boxes_overlap(moving,fixed):return true
	return false

func boxes_overlap(a: Dictionary,b: Dictionary) -> bool:
	var at: Transform3D=a.node.global_transform;var bt: Transform3D=b.node.global_transform
	var center_a: Vector3=at*a.center;var center_b: Vector3=bt*b.center
	var axes_a: Array[Vector3]=[at.basis.x.normalized(),at.basis.y.normalized(),at.basis.z.normalized()]
	var axes_b: Array[Vector3]=[bt.basis.x.normalized(),bt.basis.y.normalized(),bt.basis.z.normalized()]
	var axes: Array[Vector3]=[];axes.append_array(axes_a);axes.append_array(axes_b)
	for x: Vector3 in axes_a:
		for y: Vector3 in axes_b:axes.append(x.cross(y))
	var delta: Vector3=center_b-center_a
	for axis: Vector3 in axes:
		if axis.length_squared()<0.00000001:continue
		var ra: float=0.0;var rb: float=0.0
		for i in range(3):
			ra+=float(a.half[i])*at.basis[i].length()*absf(axis.dot(axes_a[i]))
			rb+=float(b.half[i])*bt.basis[i].length()*absf(axis.dot(axes_b[i]))
		if absf(delta.dot(axis))>ra+rb:return false
	return true

func restart() -> void:
	if snap!=null:snap.kill()
	route.clear();drag.clear();won=false;completion.visible=false
	location=level.startAnchor.duplicate();set_meta("turns",0);apply_pose(PI/2.0)

func verify() -> void:
	var failures: Array[String]=[]
	for pose: float in [0.0,PI/2.0]:
		apply_pose(pose)
		if not navigation.route(level.startAnchor,level.goalAnchor).is_empty():failures.append("single pose solves level")
	apply_pose(PI/2.0)
	var landing: Dictionary={"segment":"landing","t":0.25};var middle: Dictionary={"segment":"middle-2","t":1.0}
	if navigation.route(level.startAnchor,landing).is_empty():failures.append("approach route missing")
	if not navigation.route(landing,middle).is_empty():failures.append("folded cap creates a shortcut")
	apply_pose(0.0)
	var cap_route: Array=navigation.route(landing,middle)
	if cap_route.is_empty():failures.append("upright cap route missing")
	var caps: Array=[]
	for leg: Dictionary in cap_route:
		if str(leg.get("segment","")).begins_with("deck-cap"):caps.append(leg.segment)
	if not "deck-cap-x" in caps or not "deck-cap-z" in caps:failures.append("cap surfaces skipped")
	if not navigation.route(middle,level.goalAnchor).is_empty():failures.append("upright exit shortcut")
	apply_pose(PI/2.0)
	if navigation.route(middle,level.goalAnchor).is_empty():failures.append("folded exit missing")
	for i in range(181):
		var a: float=float(i)*PI/360.0;apply_pose(a)
		if colliding():failures.append("collision at "+str(i/2.0))
		if absf(crank.rotation.z-angle)>0.00001:failures.append("crank rotation reversed")
	apply_pose(PI/2.0)
	print("GODOT_VERIFY ","PASS" if failures.is_empty() else "FAIL"," | two-turn route, cap handoff, 181 collision poses, crank direction")
	for failure: String in failures:push_error(failure)
	get_tree().quit(0 if failures.is_empty() else 1)

func capture_sequence() -> void:
	var directory: String=ProjectSettings.globalize_path("res://../artifacts/godot-captures")
	DirAccess.make_dir_recursive_absolute(directory)
	for degree: int in [0,50,65,80,90]:
		apply_pose(deg_to_rad(degree))
		for i in range(5):await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(directory+"/gate-"+str(degree)+".png")
	print("GODOT_CAPTURE ",directory)
	get_tree().quit()
