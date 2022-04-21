
人体骨骼列表：https://en.wikipedia.org/wiki/List_of_bones_of_the_human_skeleton

|人体骨骼|人体骨骼数量|对应 Unity 人形骨骼数量（最多）|对应 Unity 人形骨骼数量（最少）| 对应Unity 人形骨骼（下划线为必须存在）|
|--|--|--|--|--|
|脊柱|26|5|2| <ul><li><ins>Hips</ins></li><li><ins>Spine</ins></li><li>Chest</li><li>UpperChest</li><li>Neck</li></ul> |
|胸部|25|0|0||
|头部|23|4|1| <ul><li><ins>Head</ins></li><li>Eye * 2</li><li>Jaw</li></ul> |
|臂骨|20|6|4| <ul><li>Shoulder * 2</li><li><ins>UpperArm * 2</li><li></ins><ins>LowerArm * 2</ins></li></ul> |
|手|54|32|2| <ul><li><ins>Hand * 2</ins></li><li>Finger * 3 * 5 * 2</li></ul> |
|腿部|60|8|6| <ul><li><ins>UpperLeg * 2</ins></li><li><ins>LowerLeg * 2</ins></li><li><ins>Foot * 2</ins></li><li>Toes * 2</li></ul> |
|--|--|--|
|总计|206|55|15||


boneQ = world rotation of bone
parentQ = world rotation of bone's parent
zeroQ = ??

preQ = inv(parentQ) * zeroQ * uvw
postQ = inv(boneQ) * uvw

project(q)
  = inv(preQ) * q * postQ
  = inv(inv(parentQ) * zeroQ * uvw) * q * inv(boneQ) * uvw
  = inv(uvw) * inv(zeroQ) * parentQ * q * inv(boneQ) * uvw

unproject(q)
  = preQ * q * inv(postQ)
  = inv(parentQ) * zeroQ * uvw * q * inv(inv(boneQ) * uvw)
  = inv(parentQ) * zeroQ * uvw * q * inv(uvw) * boneQ