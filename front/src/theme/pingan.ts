import { theme, type ThemeConfig } from 'antd'

/** One application-wide theme, including route changes and portalled dialogs; state colors stay semantic. */
export const pinganTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#a855f7',
    colorInfo: '#a855f7',
    colorBgLayout: '#08080b',
    colorBgContainer: '#18181d',
    colorBgElevated: '#222228',
    colorText: '#f4f4f5',
    colorTextSecondary: '#a1a1aa',
    colorBorder: '#36363f',
    colorBorderSecondary: '#292930',
    borderRadius: 10,
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: { primaryShadow: 'none' },
    Card: { headerFontSize: 14 },
    Tabs: { horizontalItemGutter: 20 },
  },
}
