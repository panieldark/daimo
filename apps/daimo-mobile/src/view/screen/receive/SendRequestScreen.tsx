import { dollarsToAmount, formatDaimoLink } from "@daimo/common";
import { MAX_NONCE_ID_SIZE_BITS } from "@daimo/userop";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Alert,
  Keyboard,
  Platform,
  Share,
  ShareAction,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Hex } from "viem";
import { generatePrivateKey } from "viem/accounts";

import { Account, getAccountManager } from "../../../model/account";
import { AmountChooser } from "../../shared/AmountInput";
import { ButtonBig } from "../../shared/Button";
import { ScreenHeader } from "../../shared/ScreenHeader";
import Spacer from "../../shared/Spacer";
import { ParamListReceive, useExitBack, useExitToHome } from "../../shared/nav";
import { ss } from "../../shared/style";
import { TextCenter, TextLight } from "../../shared/text";
import { useWithAccount } from "../../shared/withAccount";

type Props = NativeStackScreenProps<ParamListReceive, "SendReq">;

export default function SendRequestScreen({ route }: Props) {
  const { dollars } = route.params || {};
  const Inner = useWithAccount(SendRequestScreenInner);
  return <Inner dollars={dollars} />;
}

function SendRequestScreenInner({
  account,
  dollars,
}: {
  account: Account;
  dollars: number;
}) {
  // On successful send, go home
  // const [status, setStatus] = useState<"sending" | "sent">("sending");
  const trackRequest = useTrackRequest();
  const goBack = useExitBack();
  const goHome = useExitToHome();

  const sendRequest = async () => {
    try {
      const requestId = generateRequestID();

      const url = formatDaimoLink({
        type: "request",
        recipient: account.name,
        dollars: `${dollars}`,
        requestId,
      });

      let result: ShareAction;
      if (Platform.OS === "android") {
        result = await Share.share({ message: url });
      } else {
        result = await Share.share({ url }); // Default behavior for iOS
      }

      console.log(`[REQUEST] action ${result.action}`);
      if (result.action === Share.sharedAction) {
        console.log(`[REQUEST] shared, activityType: ${result.activityType}`);
        // setStatus("sent");
        trackRequest(requestId, dollars);
        goHome();
        // nav.navigate("HomeTab", { screen: "Home" });
      } else if (result.action === Share.dismissedAction) {
        // Only on iOS
        console.log(`[REQUEST] share dismissed`);
        // setStatus("creating");
      }
    } catch (error: any) {
      Alert.alert(error.message);
    }
  };

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
          onSetDollars={() => {}}
          showAmountAvailable={false}
          autoFocus={false}
          lagAutoFocus={false}
          onFocus={goBack}
        />
        <Spacer h={32} />
        <View style={ss.container.padH16}>
          <ButtonBig
            type="primary"
            title="Send Request"
            onPress={sendRequest}
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

function useTrackRequest() {
  return (requestId: `${bigint}`, dollars: number) => {
    getAccountManager().transform((account) => ({
      ...account,
      trackedRequests: [
        ...account.trackedRequests,
        {
          requestId,
          amount: `${dollarsToAmount(dollars)}` as `${bigint}`,
        },
      ],
    }));
  };
}

function generateRequestID() {
  const hexRandomString = generatePrivateKey().slice(
    0,
    2 + Number(MAX_NONCE_ID_SIZE_BITS / 4n) // One hex is 4 bits
  ) as Hex; // Uses secure random.
  return `${BigInt(hexRandomString)}` as `${bigint}`;
}
