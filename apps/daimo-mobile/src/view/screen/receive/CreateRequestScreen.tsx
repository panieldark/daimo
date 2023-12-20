import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import {
  Keyboard,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { AmountChooser } from "../../shared/AmountInput";
import { ButtonBig } from "../../shared/Button";
import { ScreenHeader } from "../../shared/ScreenHeader";
import Spacer from "../../shared/Spacer";
import {
  ParamListReceive,
  useExitToHome,
  useFocusOnScreenTransitionEnd,
  useNav,
} from "../../shared/nav";
import { ss } from "../../shared/style";
import { TextCenter, TextLight } from "../../shared/text";

type Props = NativeStackScreenProps<ParamListReceive, "CreateReq">;

export function CreateRequestScreen(props: Props) {
  const { autoFocus } = props.route.params || {};
  const [dollars, setDollars] = useState(0);

  // Enter number > got to SendRequestScreen
  const nav = useNav();
  const goToSend = () => {
    const params = { dollars };
    nav.navigate("ReceiveTab", { screen: "SendReq", params });
  };

  // Work around react-navigation autofocus bug
  const isFocused = useIsFocused();
  const textInputRef = useRef<TextInput>(null);
  useFocusOnScreenTransitionEnd(textInputRef, nav, isFocused, autoFocus);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={ss.container.screen}>
        <ScreenHeader title="Request" onExit={useExitToHome()} />
        <Spacer h={96} />
        <TextCenter>
          <TextLight>Enter amount to request</TextLight>
        </TextCenter>
        <Spacer h={8} />
        <AmountChooser
          dollars={dollars}
          onSetDollars={setDollars}
          showAmountAvailable={false}
          autoFocus={false}
          lagAutoFocus={false}
          innerRef={textInputRef}
        />
        <Spacer h={32} />
        <View style={ss.container.padH16}>
          <ButtonBig
            type="primary"
            disabled={dollars <= 0}
            title="Send Request"
            onPress={goToSend}
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
