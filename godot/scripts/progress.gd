extends Node

var selected: int = 0
var completed: Array = []
var sound_enabled: bool = false
var start_with_menu: bool = true

func _ready() -> void:
	if FileAccess.file_exists("user://progress.json"):
		var saved: Variant=JSON.parse_string(FileAccess.get_file_as_string("user://progress.json"))
		if saved is Dictionary:
			selected=clampi(int(saved.get("selected",0)),0,3)
			completed=saved.get("completed",[]).map(func(index):return int(index))
			sound_enabled=bool(saved.get("sound",false))
	elif OS.has_feature("web"):
		# Keep existing players' completed chapters when the site switches engines.
		var previous: Variant=JSON.parse_string(str(JavaScriptBridge.eval("(()=>{try{return localStorage.getItem('mist-isles-reference-v1')||'{}'}catch{return '{}'}})()")))
		if previous is Dictionary:
			selected=clampi(int(previous.get("level",0)),0,3)
			var ids: Array=["folded-frame","double-cloister","blue-gate","hanging-stair"]
			for id: String in previous.get("completed",[]):
				if id in ids:completed.append(ids.find(id))
			save()

func save() -> void:
	var file := FileAccess.open("user://progress.json",FileAccess.WRITE)
	if file!=null:file.store_string(JSON.stringify({"selected":selected,"completed":completed,"sound":sound_enabled}))

func finish(index: int) -> void:
	if not index in completed:completed.append(index)
	save()

func select(index: int) -> void:
	selected=clampi(index,0,3);start_with_menu=false;save()
	get_tree().reload_current_scene()
