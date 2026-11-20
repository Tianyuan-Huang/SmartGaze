export type PushState='off'|'camera'|'waiting-frame'|'processing'|'retry'|'refresh'|'quiet'|'ready'|'speaking'|'paused'
export const pushLabels:Record<PushState,[string,string]>={
 off:['视觉未开启','Vision off'],camera:['正在开启相机…','Opening camera…'],
 'waiting-frame':['等待清晰画面…','Waiting for a clear frame…'],
 processing:['正在识别…','Recognizing…'],retry:['服务暂忙，正在重试…','Service busy, retrying…'],
 refresh:['画面已更新，重新识别…','Scene updated, recognizing again…'],
 quiet:['推送中 · 暂无新提示','Assisting · no new alert'],ready:['推送已开启','Assistance on'],
 speaking:['正在播报…','Speaking…'],paused:['推送已暂停','Assistance paused']
}
