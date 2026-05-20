import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 桌宠样式配置
export interface PetStyle {
  // 颜色
  primaryColor: string      // 主色（眼睛、核心）
  secondaryColor: string    // 次要色（天线球）
  bodyColor: string         // 身体颜色
  bodyBorderColor: string   // 身体边框
  visorColor: string        // 面罩颜色
  eyeColor: string          // 眼睛发光色
  
  // 形状参数（0-1之间的值，用于调整比例）
  headSize: number          // 头部大小
  bodySize: number          // 身体大小
  antennaHeight: number     // 天线高度
  
  // 精灵图（可选，如果设置则使用图片代替CSS绘制）
  spriteSheet?: string      // base64 或 URL
  spriteFrameWidth?: number
  spriteFrameHeight?: number
  spriteFrames?: number
}

// 预设主题
export const presetThemes: { id: string; name: string; icon: string; style: PetStyle }[] = [
  {
    id: 'cyan',
    name: 'Cyan Tech',
    icon: '🔵',
    style: {
      primaryColor: '#00D4AA',
      secondaryColor: '#F59E0B',
      bodyColor: '#334155',
      bodyBorderColor: '#475569',
      visorColor: '#0F172A',
      eyeColor: '#00F5C8',
      headSize: 1,
      bodySize: 1,
      antennaHeight: 1
    }
  },
  {
    id: 'red',
    name: 'Crimson Bot',
    icon: '🔴',
    style: {
      primaryColor: '#EF4444',
      secondaryColor: '#FCD34D',
      bodyColor: '#451a1a',
      bodyBorderColor: '#7f1d1d',
      visorColor: '#1a0505',
      eyeColor: '#FCA5A5',
      headSize: 1,
      bodySize: 1,
      antennaHeight: 1
    }
  },
  {
    id: 'green',
    name: 'Emerald Unit',
    icon: '🟢',
    style: {
      primaryColor: '#22C55E',
      secondaryColor: '#86EFAC',
      bodyColor: '#14532d',
      bodyBorderColor: '#166534',
      visorColor: '#052e16',
      eyeColor: '#4ADE80',
      headSize: 1,
      bodySize: 1,
      antennaHeight: 1
    }
  },
  {
    id: 'purple',
    name: 'Violet Core',
    icon: '🟣',
    style: {
      primaryColor: '#A855F7',
      secondaryColor: '#C084FC',
      bodyColor: '#3b0764',
      bodyBorderColor: '#581c87',
      visorColor: '#1a0333',
      eyeColor: '#D8B4FE',
      headSize: 1,
      bodySize: 1,
      antennaHeight: 1
    }
  },
  {
    id: 'orange',
    name: 'Amber Droid',
    icon: '🟠',
    style: {
      primaryColor: '#F97316',
      secondaryColor: '#FDBA74',
      bodyColor: '#431407',
      bodyBorderColor: '#7c2d12',
      visorColor: '#1a0500',
      eyeColor: '#FED7AA',
      headSize: 1,
      bodySize: 1,
      antennaHeight: 1
    }
  },
  {
    id: 'pink',
    name: 'Rose Companion',
    icon: '🩷',
    style: {
      primaryColor: '#EC4899',
      secondaryColor: '#F9A8D4',
      bodyColor: '#4a044e',
      bodyBorderColor: '#86198f',
      visorColor: '#1a0318',
      eyeColor: '#FBCFE8',
      headSize: 1,
      bodySize: 1,
      antennaHeight: 1
    }
  },
  {
    id: 'gold',
    name: 'Golden Bot',
    icon: '🟡',
    style: {
      primaryColor: '#EAB308',
      secondaryColor: '#FDE047',
      bodyColor: '#422006',
      bodyBorderColor: '#713f12',
      visorColor: '#1a1000',
      eyeColor: '#FEF08A',
      headSize: 1,
      bodySize: 1,
      antennaHeight: 1
    }
  },
  {
    id: 'white',
    name: 'Arctic Unit',
    icon: '⚪',
    style: {
      primaryColor: '#E2E8F0',
      secondaryColor: '#94A3B8',
      bodyColor: '#1E293B',
      bodyBorderColor: '#334155',
      visorColor: '#0F172A',
      eyeColor: '#F8FAFC',
      headSize: 1,
      bodySize: 1,
      antennaHeight: 1
    }
  }
]

export const usePetStyleStore = defineStore('petStyle', () => {
  // 当前样式（默认使用第一个预设）
  const currentStyle = ref<PetStyle>({ ...presetThemes[0].style })
  const currentThemeId = ref<string>('cyan')
  
  // 是否使用自定义精灵图
  const useCustomSprite = ref(false)

  // 应用预设主题
  const applyTheme = (themeId: string) => {
    const theme = presetThemes.find(t => t.id === themeId)
    if (theme) {
      currentStyle.value = { ...theme.style }
      currentThemeId.value = themeId
      useCustomSprite.value = false
      saveToStorage()
    }
  }

  // 更新单个颜色
  const updateColor = (key: keyof PetStyle, color: string) => {
    if (key in currentStyle.value) {
      (currentStyle.value as any)[key] = color
      currentThemeId.value = 'custom'
      saveToStorage()
    }
  }

  // 更新形状参数
  const updateShape = (key: 'headSize' | 'bodySize' | 'antennaHeight', value: number) => {
    currentStyle.value[key] = Math.max(0.5, Math.min(1.5, value))
    currentThemeId.value = 'custom'
    saveToStorage()
  }

  // 导入精灵图（Petdex/Codex格式）
  const importSprite = (spriteData: {
    imageUrl: string
    frameWidth: number
    frameHeight: number
    frames: number
  }) => {
    currentStyle.value.spriteSheet = spriteData.imageUrl
    currentStyle.value.spriteFrameWidth = spriteData.frameWidth
    currentStyle.value.spriteFrameHeight = spriteData.frameHeight
    currentStyle.value.spriteFrames = spriteData.frames
    useCustomSprite.value = true
    currentThemeId.value = 'custom'
    saveToStorage()
  }

  // 清除自定义精灵图
  const clearSprite = () => {
    useCustomSprite.value = false
    delete currentStyle.value.spriteSheet
    delete currentStyle.value.spriteFrameWidth
    delete currentStyle.value.spriteFrameHeight
    delete currentStyle.value.spriteFrames
    saveToStorage()
  }

  // 保存到本地存储
  const saveToStorage = () => {
    localStorage.setItem('promptpal_pet_style', JSON.stringify({
      style: currentStyle.value,
      themeId: currentThemeId.value,
      useCustomSprite: useCustomSprite.value
    }))
  }

  // 从本地存储加载
  const loadFromStorage = () => {
    const saved = localStorage.getItem('promptpal_pet_style')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.style) currentStyle.value = parsed.style
        if (parsed.themeId) currentThemeId.value = parsed.themeId
        if (parsed.useCustomSprite !== undefined) useCustomSprite.value = parsed.useCustomSprite
      } catch {}
    }
  }

  // 生成CSS变量
  const cssVariables = computed(() => ({
    '--pet-primary-color': currentStyle.value.primaryColor,
    '--pet-secondary-color': currentStyle.value.secondaryColor,
    '--pet-body-color': currentStyle.value.bodyColor,
    '--pet-body-border-color': currentStyle.value.bodyBorderColor,
    '--pet-visor-color': currentStyle.value.visorColor,
    '--pet-eye-color': currentStyle.value.eyeColor,
    '--pet-head-size': currentStyle.value.headSize,
    '--pet-body-size': currentStyle.value.bodySize,
    '--pet-antenna-height': currentStyle.value.antennaHeight
  }))

  // 初始化
  loadFromStorage()

  return {
    currentStyle,
    currentThemeId,
    useCustomSprite,
    presetThemes,
    cssVariables,
    applyTheme,
    updateColor,
    updateShape,
    importSprite,
    clearSprite
  }
})
