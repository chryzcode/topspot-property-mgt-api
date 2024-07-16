import { User } from "../models/user.js";
import { UnauthenticatedError, NotFoundError } from "../errors/index.js";

const checkContractorAccountStatus = async (req, res, next) => {
  try {
    const { userId } = req.user; // Assuming userId is attached to req.user during authentication
    const user = await User.findOne({ _id: userId });

    if (!user) {
      throw new NotFoundError(`User does not exist`);
    }

    if (user.userType === "contractor" && user.contractorAccountStatus !== "active") {
      throw new UnauthenticatedError("Your contractor account is not active. Please contact support.");
    }

    req.user = { userId: user.id }; // Optionally, you can retain the existing user object
    next();
  } catch (error) {
    next(error);
  }
};

export default checkContractorAccountStatus;
