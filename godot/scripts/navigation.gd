class_name GateNavigation
extends RefCounted

const Optics = preload("res://scripts/optics.gd")
var level: Dictionary
var segments: Array[Dictionary] = []
var links: Array[Dictionary] = []
var by_id: Dictionary = {}

func _init(data: Dictionary) -> void:
	level=data

func rebuild(angle: float) -> void:
	segments.clear();links.clear();by_id.clear()
	var orientation: int = posmod(int(round(angle/(PI/2.0))),4)
	var settled: bool = absf(angle/(PI/2.0)-round(angle/(PI/2.0)))<0.001
	var pivot: Vector3 = Optics.v(level.pivot)
	var q := Optics.rotation(level,angle)
	var nodes: Dictionary = {}
	for source: Dictionary in level.segments:
		var s: Dictionary=source.duplicate(true)
		s.p0=Optics.v(source.p0);s.p1=Optics.v(source.p1);s.up=Optics.v(source.up)
		s.enabled=true
		if source.get("dynamic",false):
			s.p0=q*s.p0+pivot;s.p1=q*s.p1+pivot;s.up=q*s.up
			s.enabled=settled and (source.get("states")==null or source.states.any(func(state):return int(state)==orientation))
		segments.append(s);by_id[s.id]=s
		nodes[s.a]={"point":s.p0,"enabled":s.enabled};nodes[s.b]={"point":s.p1,"enabled":s.enabled}
	for link: Dictionary in level.joints:
		if link.has("states") and (not settled or not link.states.any(func(state):return int(state)==orientation)):
			continue
		var a: Dictionary=nodes.get(link.a,{})
		var b: Dictionary=nodes.get(link.b,{})
		if a.is_empty() or b.is_empty() or not a.enabled or not b.enabled:
			continue
		var delta: Vector3=b.point-a.point
		var projected: Vector3=delta-Optics.VIEW_RAY*delta.dot(Optics.VIEW_RAY)
		if delta.length()<0.11 or projected.length()<0.012:
			links.append(link)

func point(anchor: Dictionary) -> Vector3:
	var s: Dictionary=by_id[anchor.segment]
	return s.p0.lerp(s.p1,clampf(float(anchor.t),0.0,1.0))

func closest(p: Vector3,ids: Array) -> Dictionary:
	var best: Dictionary={}
	for s: Dictionary in segments:
		if not s.enabled or not s.id in ids:
			continue
		var axis: Vector3=s.p1-s.p0
		var t: float=clampf((p-s.p0).dot(axis)/axis.length_squared(),0.0,1.0) if axis.length_squared()>0.000001 else 0.0
		var distance: float=p.distance_to(s.p0.lerp(s.p1,t))
		if best.is_empty() or distance<float(best.distance):
			best={"segment":s.id,"t":t,"distance":distance}
	return best

func route(source: Dictionary,target: Dictionary) -> Array:
	if not by_id.has(source.segment) or not by_id.has(target.segment):
		return []
	var graph: Dictionary={};var positions: Dictionary={};var anchors: Dictionary={}
	for s: Dictionary in segments:
		if not s.enabled: continue
		var parts: Array=[{"t":0.0,"id":s.a},{"t":1.0,"id":s.b}]
		if source.segment==s.id: parts.append({"t":float(source.t),"id":"@source"})
		if target.segment==s.id: parts.append({"t":float(target.t),"id":"@target"})
		parts.sort_custom(func(a,b):return a.t<b.t)
		for p: Dictionary in parts:
			positions[p.id]=s.p0.lerp(s.p1,p.t);anchors[p.id]={"segment":s.id,"t":p.t}
		for i in range(parts.size()-1):
			for pair: Array in [[parts[i],parts[i+1]],[parts[i+1],parts[i]]]:
				var a: Dictionary=pair[0];var b: Dictionary=pair[1]
				add_edge(graph,a.id,b.id,{"segment":s.id,"from_t":a.t,"to_t":b.t,"from":positions[a.id],"to":positions[b.id]},absf(b.t-a.t)*s.p0.distance_to(s.p1))
	for link: Dictionary in links:
		for pair: Array in [[link.a,link.b],[link.b,link.a]]:
			if positions.has(pair[0]) and positions.has(pair[1]):
				add_edge(graph,pair[0],pair[1],{"teleport":true,"end":anchors[pair[1]]},0.0)
	var distances: Dictionary={"@source":0.0};var previous: Dictionary={};var visited: Dictionary={}
	while true:
		var current: String="";var minimum: float=INF
		for id: String in distances:
			if not visited.has(id) and float(distances[id])<minimum:
				current=id;minimum=distances[id]
		if current.is_empty(): return []
		if current=="@target": break
		visited[current]=true
		for edge: Dictionary in graph.get(current,[]):
			var distance: float=minimum+float(edge.cost)
			if distance<float(distances.get(edge.to,INF)):
				distances[edge.to]=distance;previous[edge.to]={"from":current,"leg":edge.leg}
	var result: Array=[];var id: String="@target"
	while id!="@source":
		if not previous.has(id):return []
		result.push_front(previous[id].leg);id=previous[id].from
	return result

func add_edge(graph: Dictionary,a: String,b: String,leg: Dictionary,cost: float) -> void:
	if not graph.has(a):graph[a]=[]
	graph[a].append({"to":b,"cost":cost,"leg":leg})
