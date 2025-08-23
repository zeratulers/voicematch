/**
 * 性别相关工具函数
 */

import type { Gender } from '../types/patient'

/**
 * 格式化性别显示
 * @param gender 性别枚举值
 * @returns 中文性别显示
 */
export const formatGender = (gender: Gender | string): string => {
  switch (gender) {
    case 'MALE':
    case 'M': // 兼容旧值
      return '男'
    case 'FEMALE':
    case 'F': // 兼容旧值
      return '女'
    case 'OTHER':
    case 'Other': // 兼容旧值
      return '其他'
    default:
      return '其他'
  }
}

/**
 * 获取性别选项
 * @returns 性别选项数组
 */
export const getGenderOptions = () => [
  { value: 'MALE', label: '男' },
  { value: 'FEMALE', label: '女' },
  { value: 'OTHER', label: '其他' },
]
