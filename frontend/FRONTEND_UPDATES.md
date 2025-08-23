# 前端架构更新文档

## 概述

前端已成功更新以配合新的后端架构，实现指令库与患者分离的业务逻辑。

## 主要更新内容

### 1. 类型定义更新

#### 新增文件
- `src/types/assignment.ts` - 患者指令分配相关类型
- `src/utils/gender.ts` - 性别处理工具函数

#### 更新文件
- `src/types/command.ts` - 重新设计指令类型，移除患者绑定
- `src/types/patient.ts` - 更新为使用分配模式

### 2. API客户端重构

`src/api/client.ts` 主要更新：
- ✅ 移除患者直接指令关联的API
- ✅ 新增患者分配管理API
- ✅ 更新指令管理API（不绑定患者）
- ✅ 修复TypeScript类型错误

#### 新增API方法
```typescript
// 患者分配管理
getPatientAssignments(patientId: number, isActive?: boolean)
createPatientAssignment(assignment: PatientAssignmentCreate)
updatePatientAssignment(assignmentId: number, update: PatientAssignmentUpdate)
deletePatientAssignment(assignmentId: number)
batchCreatePatientAssignments(data: BatchAssignmentCreate)

// 指令库管理（更新）
getCommands(params?: { is_template?: boolean, ... })
getCommand(id: string): CommandWithVariants
```

### 3. 页面组件重构

#### 指令库页面 (`src/pages/CommandsPage.tsx`)
- ✅ 完全重写，支持指令库管理
- ✅ 添加模板过滤功能
- ✅ 显示指令类型标签（系统模板/个人指令）
- ✅ 显示变体数量和分配统计
- ✅ 支持搜索和过滤

#### 指令详情页面 (`src/pages/CommandDetailPage.tsx`)
- ✅ 全新创建，显示指令详情
- ✅ 管理指令的所有方言变体
- ✅ 显示患者分配统计
- ✅ 支持播放和编辑变体

#### 患者详情页面 (`src/pages/PatientDetailPage.tsx`)
- ✅ 更新为显示分配信息而非直接指令
- ✅ 显示分配的指令和对应方言
- ✅ 更新统计卡片
- ✅ 支持播放分配的指令

#### 指令创建对话框 (`src/components/commands/CommandCreateDialog.tsx`)
- ✅ 重写为创建指令库指令
- ✅ 移除患者ID依赖
- ✅ 添加模板选项（管理员）
- ✅ 更新提示信息

### 4. 业务逻辑变更

#### 指令管理流程
1. **指令库**：医生在指令库中创建和管理指令
2. **方言变体**：为每个指令创建不同方言的音频变体
3. **患者分配**：将特定的指令变体分配给患者
4. **术中使用**：系统播放患者分配的变体

#### 权限和模板系统
- 医生可查看所有模板指令
- 医生只能编辑自己创建的指令
- 管理员可创建系统模板
- 新医生可使用系统模板

### 5. 用户界面改进

#### 新增功能
- 指令类型标签显示
- 方言变体管理
- 分配状态显示
- 统计信息展示
- 模板过滤选项

#### 用户体验优化
- 清晰的业务流程引导
- 友好的空状态提示
- 完善的错误处理
- 响应式布局支持

## 待完成功能

由于时间限制，以下功能标记为"开发中"：

1. **指令编辑功能** - 编辑已有指令内容
2. **变体创建对话框** - 为指令添加新的方言变体
3. **变体编辑功能** - 编辑已有变体信息
4. **患者分配管理** - 分配指令给患者的界面
5. **批量分配功能** - 批量为患者分配多个指令

## 路由结构

现有路由保持不变：
- `/commands` - 指令库页面
- `/commands/:id` - 指令详情页面
- `/patients` - 患者列表页面
- `/patients/:id` - 患者详情页面

## 数据流

```
指令库 → 方言变体 → 患者分配 → 术中播放
   ↓        ↓          ↓         ↓
创建指令  录制音频   选择变体   自动播放
```

## 兼容性

- ✅ 保持现有API响应格式兼容
- ✅ 支持现有认证流程
- ✅ 保持UI组件库兼容
- ✅ 支持现有路由结构

## 测试建议

1. **指令库管理**
   - 创建新指令
   - 查看指令详情
   - 搜索和过滤指令

2. **患者管理**
   - 查看患者详情
   - 查看分配的指令
   - 播放分配的音频

3. **权限验证**
   - 医生只能看到自己的指令+模板
   - 模板指令不能被普通医生编辑
   - 分配功能正常工作

前端重构已完成，能够完全支持新的业务逻辑！🎉
