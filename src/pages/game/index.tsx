import {Image, View} from "remax/wechat"
import * as React from 'react';
import Plate, { PlateInput } from "@/components/Plate"
import * as wx from 'remax/wechat'
import { useEffect, useState } from "react";
import store from "@/redux/store";
import { GameStep, UpdateType } from "@/redux/gameReducer";
import { checkEaten, countResult, getRandomInt } from "./gameStrategy";
import { blueTurnAct, blueWinAct, doXiaoUpdate, gameSetAct, initialGameAct, redTurnAct, redWinAct, tiedAct } from "@/redux/gameReducer/actions";
import Dice from "@/components/Dice";

/**
 *
 * @author csq
 */


const toSetting = () => {
    wx.navigateTo({
        url:'../settings/index'
    })
}


export default() => {
    //总游戏状态
    let gameState = store.getState().combineReducer.game
    //游戏进度
    let gameStep =  gameState.type
    //上半部分棋盘
    let blueGrid =  gameState.gridBlue;
    let redGrid = gameState.gridRed;

    const [state, setState]  = useState<PlateInput>({gameStep:GameStep.INTITIAL_GAME, value:null});

    //一些通用方法
    //结算通用弹窗
    function scored(side:string){
        wx.showModal({
            title:'游戏结束',
            content:side+'胜利',
            success(res){
                if(res.confirm){
                    setTimeout(() => {}, 3000)
                }else{
                    store.dispatch(initialGameAct())
                    wx.navigateTo({
                        url:'../index/index'
                    })
                }
                store.dispatch(initialGameAct())
            }
        })
    }


    //为骰子获取随机值
    function getRandom(){
        if(state.gameStep == GameStep.BLUE_TURN||state.gameStep==GameStep.RED_TURN){
            if(state.value==0){
                const random = getRandomInt()
                if(state.gameStep ==GameStep.BLUE_TURN){
                    store.dispatch(blueTurnAct(random))
                }else{
                    store.dispatch(redTurnAct(random))
                }
                setState({ ...state, value:random})
            }
        }

    }

    useEffect(() => {
        //初始化完成后启动一次
        if(state.gameStep == GameStep.INTITIAL_GAME){
            setTimeout(()=> {
                const first = getRandomInt()
                if(first>3){
                    wx.showToast({
                        title:'蓝方先手,请掷骰',
                        icon:'none',
                        duration:1500
                    })
                    store.dispatch(blueTurnAct(0))
                }else{
                    wx.showToast({
                        title:'红方先手,请掷骰',
                        icon:'none',
                        duration:1500
                    })
                    store.dispatch(redTurnAct(0))
                }
            },100)
        }
    },[])

    //监听全局变化
    //在这里页面可以实时监控到游戏状态发生的变化并处理
    store.subscribe(() => {
        //每次全局发生变化就要更新状态
        gameState = store.getState().combineReducer.game
        gameStep =  gameState.type
        blueGrid =  gameState.gridBlue;
        redGrid = gameState.gridRed;

        //第一步，检查游戏进度是否发生了变化
        if(state.gameStep != gameStep){
            if(gameStep == GameStep.BLUE_TURN || gameStep == GameStep.RED_TURN){
                setState({gameStep:gameStep, value:gameState.currentValue})
            }else{
                setState({...state, gameStep:gameStep})
            }
        }
        //第二步，判断状态的特点
        //如果这是初始化进程
        if(gameStep == GameStep.INTITIAL_GAME){
            setState({gameStep: GameStep.INTITIAL_GAME, value: null})
        }

        //如果游戏处于更新状态中
        if(gameStep == GameStep.UPDATE_STEP){
            const toBeUpdated = gameState.toBeUpdated
            const currentValue = gameState.currentValue
            const updateType = gameState.updateType

            //如果更新类型是更新随机数，不做处理
            if(updateType == UpdateType.GET_RANDOM){
                return;
            }

            //如果是一般更新，判定是来自按键或是来自消消乐
            if(updateType == UpdateType.NORMAL){
                if(toBeUpdated == GameStep.BLUE_TURN){
                    //如果更新请求来自按键，则检查是否可消除，若可消除，则执行消除动作
                    if(gameState.modifiedAt!=undefined){
                        const modifyAt = gameState.modifiedAt
                        //如果是来自按键的更新请求，检查其是否需要消消乐，若需要则发送消消乐事件
                        const eaten = checkEaten(redGrid,currentValue, modifyAt)
                        if(eaten.length!=0){
                            store.dispatch(doXiaoUpdate(eaten,GameStep.BLUE_TURN))
                        }else{
                            checkJump(blueGrid,redGrid,'red',0)
                        }
                    }else{
                        //交换位置
                        checkJump(blueGrid,redGrid,'red',0)
                    }
                }else if(toBeUpdated == GameStep.RED_TURN){
                    //如果更新请求来自按键，则检查是否可消除，若可消除，则执行消除动作
                    if(gameState.modifiedAt!=undefined){
                        const modifyAt = gameState.modifiedAt
                        const eaten = checkEaten(blueGrid,currentValue, modifyAt)
                        if(eaten.length!=0){
                            store.dispatch(doXiaoUpdate(eaten,GameStep.RED_TURN))
                        }else{
                            //交换位置
                            checkJump(blueGrid,redGrid,'blue',0)
                        }
                    }else{
                        checkJump(blueGrid,redGrid,'blue',0)
                    }
                }
            }
        }

        //游戏结束，开始结算
        if(gameState.type==GameStep.GAME_SET){
            wx.showLoading({
                title:'稍等，正在计算结果...',
                mask:true,
            })
            switch(countResult(blueGrid, redGrid)){
                case 'blue':
                    store.dispatch(blueWinAct())
                    break;
                case 'red':
                    store.dispatch(redWinAct())
                    break;
                case 'tied':
                    store.dispatch(tiedAct())
                    break;
                default:break;
            }
            wx.hideLoading()
        }

        //决定更新后的下一步进度
        function checkJump (gridBlue:any[], gridRed:any[],dispatchTo:string, dispatchNum:number){
            if(gridBlue.includes(null)&&gridRed.includes(null)){
                //交换位置
                if(dispatchTo == 'blue'){
                    store.dispatch(blueTurnAct(dispatchNum))
                }else{
                    store.dispatch(redTurnAct(dispatchNum))
                }
            }else{
                store.dispatch(gameSetAct())
                wx.navigateTo({
                    url:'../summary/index'
                })
            }
        }

        //结算完毕
        // if(store.getState().combineReducer.game.type==GameStep.BLUE_WIN){
        //     scored('蓝方')
        // }
        // else if(store.getState().combineReducer.game.type ==GameStep.RED_WIN){
        //     scored('红方')
        // }
        // else if(store.getState().combineReducer.game.type==GameStep.TIED){
        //     scored('平局')
        // }

    })

    function setUpperPlate():boolean{
        switch(state.gameStep){
            case GameStep.INTITIAL_GAME:
            case GameStep.GAME_SET:
            case GameStep.BLUE_WIN:
            case GameStep.RED_WIN:
            case GameStep.RED_TURN:
            default:
                return false;
            case GameStep.BLUE_TURN:
                if(state.value==0){
                    return false;
                }
                return true;
        }
    }

    function setLowerPlate():boolean{
        switch(state.gameStep){
            case GameStep.INTITIAL_GAME:
            case GameStep.GAME_SET:
            case GameStep.BLUE_WIN:
            case GameStep.RED_WIN:
            case GameStep.BLUE_TURN:
            default:
                return false;
            case GameStep.RED_TURN:
                if(state.value==0){
                    return false;
                }
                return true;
        }
    }
    return(
        <View className="game-page">

            <View className="upper-panel">
                <Plate theme = 'red'
                       optAble = {setUpperPlate()}
                       value = {state.value}></Plate>
            </View>
            <View className="middle-dice">
                <Dice value = {state.value} onClick = {getRandom}></Dice>
            </View>
            <View className="lower-panel">
                <Plate theme = 'blue'
                       optAble = {setLowerPlate()}
                       value = {state.value}></Plate>
            </View>
            <Image className='oppenent'
                   src='https://i.postimg.cc/VvZN7NTx/oppenent.jpg'/>
            <Image className='me'
                   src='https://i.postimg.cc/V6YLmMcy/me.jpg'/>
            <Image className='biao1'
                   src='https://i.postimg.cc/bJT0wQD1/biao1.jpg'/>
            <Image className='biao2'
                   src='https://i.postimg.cc/6qbddth3/biao2.jpg'/>
            <Image className='game-setting'
                   src='https://i.postimg.cc/GppfCmth/shezhi.jpg'
                   onClick = {toSetting}/>

        </View>
    )
}