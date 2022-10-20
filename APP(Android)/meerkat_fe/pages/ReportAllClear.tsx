import { StackScreenProps } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  View,
  Button,
  Alert,
  StyleSheet,
  Pressable,
  TextInput,
  Text,
} from 'react-native';
import { AllClearResponseType, RootStackParamList } from '../common/types.d';
import ChatroomHeader from '../components/Chatroom/ChatroomHeader';
import api from '../common/api';
import Select from './ChatroomList/Select';

type ReportAllClearProps = StackScreenProps<
  RootStackParamList,
  'ReportAllClear'
>;

// 이상무 보고
export default function ReportAllClear(props: ReportAllClearProps) {
  // params
  const { navigation } = props;
  const { messageId, chatroomId } = props.route.params;

  // state
  const [isSubmitActive, setIsSubmitActive] = useState(true);

  // data
  const [allClearType, setAllClearType] = useState(AllClearResponseType.CLEAR);
  const [content, setContent] = useState('');
  const [closeFlag, setCloseFlag] = useState(true);

  useEffect(() => {
    if (allClearType === AllClearResponseType.CLEAR)
      setContent('이상 없습니다.');
    else if (allClearType === AllClearResponseType.PROBLEM) setContent('');
  }, [allClearType]);

  // hardware back press action
  useEffect(() => {
    const backAction = () => {
      navigation.navigate('Chat', { chatroomId: chatroomId });
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  const handleClose = (closeFlag: boolean) => {
    setCloseFlag(!closeFlag);
  };

  const enableSubmit = () => {
    setIsSubmitActive(true);
  };

  const disableSubmit = () => {
    setIsSubmitActive(false);
  };

  const handleTypeChange = (type: AllClearResponseType) => {
    setAllClearType(type);
  };

  // 제출
  const submitAllClear = () => {
    disableSubmit();
    if (content === '') {
      enableSubmit();
      return Alert.alert('내용을 입력해 주세요.');
    }

    api
      .put(`/allclear/response/create`, {
        messageId: messageId,
        allClearResponseType: allClearType,
        content: content,
      })
      .then(() => {
        Alert.alert('보고가 완료되었습니다.');
        navigation.navigate('Chat', { chatroomId: chatroomId });
      })
      .catch(e => {
        console.log(e.response);
        enableSubmit();
        return Alert.alert('서버와의 통신이 원활하지 않습니다.');
      });
  };

  return (
    <>
      <ChatroomHeader
        onPressBack={() =>
          navigation.navigate('Chat', { chatroomId: chatroomId })
        }
        name={''}
      />

      <View style={styles.empty}>
        <View style={styles.container}>
          <Pressable onPress={() => handleClose(closeFlag)}>
            <View style={styles.selectBoxContainer}>
              <Pressable
                style={[
                  styles.selectBox,
                  allClearType === AllClearResponseType.CLEAR
                    ? styles.selectedBackgroundColor
                    : styles.unselectedBackgroundColor,
                ]}
                onPress={() => handleTypeChange(AllClearResponseType.CLEAR)}
              >
                <Text
                  style={[{fontSize: 16},
                    allClearType === AllClearResponseType.CLEAR
                      ? styles.selectedTextColor
                      : styles.unselectedTextColor
                  ]}
                >
                  이상 무
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.selectBox,
                  allClearType === AllClearResponseType.PROBLEM
                    ? styles.selectedBackgroundColor
                    : styles.unselectedBackgroundColor,
                ]}
                onPress={() => handleTypeChange(AllClearResponseType.PROBLEM)}
              >
                <Text
                  style={[{fontSize: 16},
                    allClearType === AllClearResponseType.PROBLEM
                      ? styles.selectedTextColor
                      : styles.unselectedTextColor
                  ]}
                >
                  특이사항
                </Text>
              </Pressable>
            </View>
            <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              onChangeText={setContent}
              value={content}
              placeholder="특이사항 입력 (200자)"
              multiline={true}
            />
            </View>
            <Pressable style={styles.submitButton} onPress={submitAllClear}>
                  <Text style={styles.submitButtonText}>제출하기</Text>
            </Pressable>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    position: 'absolute',
    //backgroundColor: 'white',
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    height: '50%',
    width: '80%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent:"space-around"
  },
  selectBoxContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectBox: {
    height: 46,
    width: '49.5%',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBackgroundColor: {
    backgroundColor: '#6A4035',
  },
  selectedTextColor: {
    color: '#FFFFFF',
  },
  unselectedBackgroundColor: {
    backgroundColor: '#E5B47F',
  },
  unselectedTextColor: {
    color: '#6A4035',
  },
  selectBoxText: {
    textAlign: 'center',
  },
  textInputContainer:{
    backgroundColor: '#FFF9D2',
    height:"80%",
    borderColor: '#6A4035',
    flexShrink: 1,
    marginTop: 17,
    marginBottom: 17,
    borderWidth: 2,
    borderRadius: 10
  },
  textInput: {
    margin: 10,
    fontSize:16,
    color:"#6A4035"
  },
  submitButton:{
    height:59,
    width:"100%",
    backgroundColor:"#6A4035",
    borderRadius:11,
    alignItems:"center",
    justifyContent:"center"
  },
  submitButtonText:{
    color:"white",
    fontSize:16
  }
});

const AllClearResponseType2Index = (responseType: AllClearResponseType) => {
  if (responseType === AllClearResponseType.CLEAR) return 0;
  else if (responseType === AllClearResponseType.PROBLEM) return 1;
  else return 0;
};

const index2AllClearResponseType = (index: number) => {
  if (index === 0) return AllClearResponseType.CLEAR;
  else if (index === 1) return AllClearResponseType.PROBLEM;
  else return AllClearResponseType.CLEAR;
};
