import {useState} from 'react'
import {t} from './i18n'

export default function AuthForm({admin,pending,ready,name,password,onName,onPassword,onSubmit}:{admin:boolean;pending:boolean;ready:boolean;name:string;password:string;onName:(v:string)=>void;onPassword:(v:string)=>void;onSubmit:(register:boolean)=>void}){
 const [register,setRegister]=useState(false)
 return <form className="login-product" onSubmit={e=>{e.preventDefault();onSubmit(register)}} aria-busy={pending}>
  <h1>{register?t('创建新账号','Create an account'):admin?t('管理员登录','Admin sign in'):t('登录 SmartGaze','Sign in to SmartGaze')}</h1>
  {register?<p className="auth-description">{t('自动分配下一个 user 编号，密码与账号名称相同。创建后即可开始使用。','Your next user number is assigned automatically. Your password is the same as your username. Start using the app after creating your account.')}</p>:<>
   <label>{t('账号','Username')}<input autoComplete="username" value={name} onChange={e=>onName(e.target.value)} disabled={pending} required/></label>
   <label>{t('密码','Password')}<input type="password" autoComplete="current-password" value={password} onChange={e=>onPassword(e.target.value)} disabled={pending} required/></label>
  </>}
  <button className="primary wide" disabled={pending||!ready}>{pending?t('请稍候…','Please wait…'):register?t('创建并登录','Create and sign in'):t('登录','Sign in')}</button>
  {!admin&&<button type="button" className="auth-alternate" disabled={pending} onClick={()=>setRegister(v=>!v)}>{register?t('已有账号？返回登录','Already have an account? Sign in'):t('创建新账号','Create an account')}</button>}
 </form>
}
