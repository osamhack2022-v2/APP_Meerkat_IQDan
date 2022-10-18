// core
import React, {
  useState,
  useCallback,
  useEffect,
  useContext,
  ReactNode,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Alert,
  Platform,
  SafeAreaView,
  BackHandler,
  Pressable,
} from 'react-native';
// comps
import ChatroomHeader from '../components/Chatroom/ChatroomHeader';
import ChatroomSide from '../components/Chatroom/ChatroomSide';
import MKBubble from '../components/Chatroom/CustomChatComp/Bubble';
import ChatroomAccessoryBar from '../components/Chatroom/ChatroomAccessoryBar';
import ChatroomTextInput from '../components/Chatroom/ChatroomTextInput';
import ChatroomTemplatePanel from '../components/Chatroom/ChatroomTemplatePanel';
// types
import {
  ChatroomWithKey,
  IMessageDto,
  RootStackScreenProps,
  User,
  QuickReplyType,
} from '../common/types.d';
// context
import { LoginContext } from '../common/Context';
// thirds
import {
  Bubble,
  BubbleProps,
  Day,
  GiftedChat,
  IMessage,
  QuickReplies,
  Reply,
  Time,
  User as IMessageUser,
} from 'react-native-gifted-chat';
import api from '../common/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useDoubleFetchAndSave from '../hooks/useDoubleFetchAndSave';
import { useSocketIO } from '../hooks/useSocketIO';
import useMessage from '../hooks/useMessage';
import { isEmpty } from '../common/isEmpty';
import FlashMessage, { showMessage } from 'react-native-flash-message';
// icons
import { MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import useRemoveMessage from '../hooks/useRemoveMessage';

export default function ChatroomPage(props: RootStackScreenProps<'Chat'>) {
  const { chatroomId } = props.route.params; // 현 채팅방의 chatroomId
  const { navigation } = props;

  // userId 가져오기
  const { isNotLoggedIn, userId } = useContext(LoginContext);
  // 소켓
  const { socket } = useSocketIO(isNotLoggedIn, null);

  // 채팅 메시지 리스트

  // UI 변화
  const [isOpenSideMenu, setIsOpenSideMenu] = useState(false); // 우측 메뉴
  const [templateVisible, setTemplateVisible] = useState(false); // 메시징 템플릿
  const [superiorOnly, setSuperiorOnly] = useState(false); // 상급자 요약
  const [msgInput, setMsgInput] = useState(''); // 현재 메세지

  // 채팅방 정보 가져오기
  const [chatroomInfo, setChatroomInfo] = useState<ChatroomWithKey | null>(
    null,
  );
  const { isLoading: isChatroomInfoLoading } =
    useDoubleFetchAndSave<ChatroomWithKey | null>(
      chatroomInfo,
      setChatroomInfo,
      '/chatroom/' + chatroomId,
    );

  // 유저 정보 가져오기
  const [usersInfo, setUsersInfo] = useState<User[]>([]);
  const { isLoading: isUserInfoLoading } = useDoubleFetchAndSave<User[] | null>(
    usersInfo,
    setUsersInfo,
    '/chatroom/getAllUsersInfo/' + chatroomId,
  );
  // 유저 정보가 받아와 졌을 때 실행
  const [IMessageUsersInfo, setIMessageUsersInfo] = useState<
    Map<number, IMessageUser>
  >(new Map<number, IMessageUser>());
  useEffect(() => {
    // map에 정보 넣기
    IMessageUsersInfo.clear();
    const newUsersInfoMap: Map<number, IMessageUser> = new Map<
      number,
      IMessageUser
    >();
    usersInfo.forEach((elem: User) => {
      newUsersInfoMap.set(elem.userId, {
        _id: elem.userId,
        name: elem.name,
        avatar: elem.image === null ? undefined : elem.image,
      });
    });
    setIMessageUsersInfo(newUsersInfoMap);
  }, [isUserInfoLoading]);

  // 메세지 삭제 카운트 (UI 용)
  const [removeCountdown, setRemoveCountdown] = useState(-1)
  // 메시지 가져오기
  const { messages, setMessages, sendNewMessageToServer, getNewMessagesFromSocket, onSend } =
    useMessage(chatroomId, userId, IMessageUsersInfo, socket);
  useRemoveMessage(messages, setMessages, chatroomInfo, removeCountdown, setRemoveCountdown)
  const [filteredMessages, setFilteredMessages] = useState<IMessage[]>([]);

  // TODO: 나중에 여기 socket 부분 분리.
  // TODO : 방 나갈 때 event 만들고 서버에서 받기.
  useEffect(() => {
    if (IMessageUsersInfo.size === 0) return;
    socket.on('connect', () => {
      console.log('--------------- room socket ---------------');
      console.log(chatroomId + ' socket connection 시작');

      socket.emit('client:joinChatroom', chatroomId);

      socket.on('server:hearMessage', (messageDto: IMessageDto) => {
        console.log(chatroomId + 'message 수신: ');
        console.log(messageDto);
        console.log(IMessageUsersInfo.get(messageDto.senderId));

        if (isEmpty(IMessageUsersInfo.get(messageDto.senderId)))
          new Error('서버에 문제가 발생했습니다.');
        getNewMessagesFromSocket([
          {
            _id: messageDto._id,
            text: messageDto.text,
            createdAt: messageDto.sendTime,
            user: IMessageUsersInfo.get(messageDto.senderId)!,
            quickReplies: messageDto.hasQuickReplies ? getAllClearQuickReply(userId, messageDto.senderId) : undefined
          },
        ]);
      });

      socket.on('disconnect', () => {
        console.log('--------------- room disconnected ---------------');
      });
    });

    socket.on('disconnect', () => {
      console.log('disconnected from server');
    });

    // clean은 hooks에서 해 줌.
    return () => {
      socket.disconnect();
    };
  }, [socket, IMessageUsersInfo]);

  // backhandler (뒤로가기 버튼) action 지정
  useEffect(() => {
    const backAction = () => {
      navigation.navigate('Main', { screen: 'ChatroomList' });
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  // superior only filter
  useEffect(() => {
    async function f() {
      try {
        if (superiorOnly) {
          const superior = await api.get('/chatroom/commander/' + chatroomId);
          const filtered = messages.filter(
            msg => msg.user._id === superior.data.data.userId,
          );
          return setFilteredMessages(filtered);
        }
      } catch (e) {
        const filtered = messages.filter(msg => msg.user._id !== userId);
        setFilteredMessages(filtered);
        Alert.alert(
          '상급자 정보를 불러오지 못했습니다. 나의 메세지만 생략합니다.',
        );
        return;
      }
      setFilteredMessages(messages);
    }
    f();
  }, [superiorOnly, messages]);

  // REFACTOR
  // TODO : refactor
  // 시계 + 읽은 사람 목록
  const ChatTime = (props: any) => {
    const { currentMessage, timeFormat } = props;
    return currentMessage.user._id === userId ? (
      <View style={styles.timeContainer}>
        <View style={styles.myEyeIconWrapper}>
          <Pressable
            onPress={() =>
              navigation.navigate('UnreadPeoples', {
                chatroomId: chatroomId,
                messageId: currentMessage._id,
              })
            }
          >
            <MaterialCommunityIcons name="eye-check" size={16} color="white" />
          </Pressable>
        </View>
        <Time
          currentMessage={currentMessage}
          timeFormat={timeFormat}
          timeTextStyle={{ left: styles.whiteText }}
        />
      </View>
    ) : (
      <View style={styles.timeContainer}>
        <Time
          currentMessage={currentMessage}
          timeFormat={timeFormat}
          timeTextStyle={{ left: styles.blackText }}
        />
        <View style={styles.othersEyeIconWrapper}>
          <Pressable
            onPress={() =>
              navigation.navigate('UnreadPeoples', {
                chatroomId: chatroomId,
                messageId: currentMessage._id,
              })
            }
          >
            <MaterialCommunityIcons name="eye-check" size={16} color="black" />
          </Pressable>
        </View>
      </View>
    );
  };

  // TODO : implement quick reply onClick event case by quick reply value
  const onQuickReply = (quickReplies:Reply[])=> {
    const quickReply = quickReplies[0];
    if(quickReply.value === QuickReplyType.REPORT){
      navigation.navigate('ReportAllClear', {
        chatroomId: chatroomId,
        messageId: quickReply.messageId,
      });
    }
    else if(quickReply.value === QuickReplyType.CHECK){
      navigation.navigate('MyAllClearReport', {
        chatroomId: chatroomId,
        messageId: quickReply.messageId,
      });
    }
    else if(quickReply.value === QuickReplyType.STATISTICS){
      navigation.navigate('AllClearStatisticsTab', {
        chatroomId: chatroomId,
        messageId: quickReply.messageId,
      });
    }
  }

  if (isUserInfoLoading || IMessageUsersInfo.size === 0) return <></>;
  return (
    <>
      <ChatroomSide
        isOpen={isOpenSideMenu}
        setIsOpen={setIsOpenSideMenu}
        usersInfo={usersInfo}
        chatroomInfo={chatroomInfo}
      />
      <SafeAreaView style={{ flex: 0 }} />
      <ChatroomHeader
        onPressBack={() =>
          navigation.navigate('Main', { screen: 'ChatroomList' })
        }
        onPressSideMenu={() => setIsOpenSideMenu(true)}
        name={chatroomInfo?.name || ''}
      />
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -300} // should be 0 for ios, but Platform.select not working currnetly.
      >
        <View style={styles.chat}>
          <GiftedChat
            messages={filteredMessages}
            onSend={(messages: any) => onSend(messages)}
            renderBubble={MKBubble}
            isCustomViewBottom={true}
            renderTime={ChatTime}
            user={{ _id: userId }}
            wrapInSafeArea={false}
            isKeyboardInternallyHandled={false}
            renderInputToolbar={() => null}
            maxComposerHeight={0}
            minInputToolbarHeight={0}
            inverted={false}
            onQuickReply={onQuickReply}
          />
          <ChatroomTextInput
            msgInput={msgInput}
            setMsgInput={setMsgInput}
            onSendTextMessage={text => sendNewMessageToServer(text)}
          />
        </View>
      </KeyboardAvoidingView>
      <ChatroomAccessoryBar
        superiorOnly={superiorOnly}
        onPressTemplate={() => setTemplateVisible(true)}
        onPressSuperiorSwitch={() => setSuperiorOnly(!superiorOnly)}
        onPressPin={() => {
          setSuperiorOnly(prev => {
            if (!prev) {
              // if superior only
              showMessage({
                message: '최상급자의 메세지만 표시됩니다.',
                type: 'info',
                backgroundColor: '#6A4035',
                color: 'white',
                position: 'bottom',
              });
            }
            return !prev;
          });
        }}
        onPressAllClear={()=> {
          sendNewMessageToServer("[이상무 보고]\n" + msgInput, true);
          setMsgInput('')
        }}
        // onSend={onSendFromUser} // TODO: 로컬에서만 보내지니까 풀어줘도될듯? 테스팅해보고 풀어주기.
        onSend={() => {}}
      />
      <ChatroomTemplatePanel
        visible={templateVisible}
        setVisible={setTemplateVisible}
        setMsgInput={setMsgInput}
      />
      <SafeAreaView style={{ flex: 0, backgroundColor: 'white' }} />
      <FlashMessage position="top" />
    </>
  );
}

////////////// quick reply //////////////
// FIXME 추후에 다른 quick reply가 생긴다면, DB에 quick reply 자체를 집어넣어야 할 것.
// get quick replies case by userid and senderid
const getAllClearQuickReply = (currentUserId: number, senderId: number)=>{
  const quickReplies: QuickReplies = {
    type: 'radio',
    keepIt: true,
    values: 
      // (currentUserId === senderId)
      // ? getAllClearStatisticsQuickReplyTemplate()
      // : getAllClearReportQuickReplyTemplate()
      (currentUserId === senderId)
      ? getAllClearReportQuickReplyTemplate()
      : getAllClearStatisticsQuickReplyTemplate()
    
  }
  return quickReplies;
}

// get 이상무 통계 quick reply template
const getAllClearStatisticsQuickReplyTemplate = ()=>{
  const statisticsReply: Reply = {
    title: "통계 확인",
    value: QuickReplyType.STATISTICS
  }
  return [statisticsReply];
}

// get 이상무 보고 quick reply template
const getAllClearReportQuickReplyTemplate = ()=>{
  const reportReply: Reply = {
    title: "보고",
    value: QuickReplyType.REPORT
  };
  const checkReply: Reply = {
    title: "보고내용 확인",
    value: QuickReplyType.CHECK
  }
  return [reportReply, checkReply];
}

const styles = StyleSheet.create({
  chat: {
    flex: 1,
    backgroundColor: 'white',
    position: 'absolute',
    width: '100%',
    height: '100%',
  },

  // message time box css
  timeContainer: {
    width: 90,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignContent: 'center',
  },
  myEyeIconWrapper: {
    height: 16,
    width: 16,
    marginLeft: 10,
  },
  othersEyeIconWrapper: {
    height: 16,
    width: 16,
    marginRight: 10,
  },
  whiteText: {
    color: 'white',
  },
  blackText: {
    color: 'black',
  },
});
